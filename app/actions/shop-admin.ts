'use server'

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAdminAction } from "@/lib/auth-helpers"
import { saveImage } from "@/lib/upload"
import { slugify } from "@/lib/shop"
import { releaseOrder } from "@/lib/order-stock"
import {
    PRODUCT_IMAGE_GROUPS,
    isProductImageCategory,
    missingRequiredGroups,
    productGroupField,
} from "@/lib/product-image-groups"
import { sendOrderShippedEmail } from "@/lib/mail"
import { formString } from "@/lib/utils"
import type { ProductImageCategory } from "@prisma/client"
import type { ActionResult } from "./registration"

const productSchema = z.object({
    name: z.string().trim().min(1, "กรุณากรอกชื่อสินค้า").max(150),
    slug: z.string().trim().max(150).optional().or(z.literal("")),
    description: z.string().trim().min(1, "กรุณากรอกรายละเอียดสินค้า"),
    type: z.enum(["STOCK", "PREORDER"]),
    status: z.enum(["DRAFT", "ACTIVE", "HIDDEN"]),
    price: z.coerce.number().min(0, "ราคาต้องไม่ติดลบ"),
    eventId: z.string().optional().or(z.literal("")),
    preorderCloseAt: z.string().optional().or(z.literal("")),
    estimatedShipAt: z.string().optional().or(z.literal("")),
    preorderNote: z.string().trim().max(2000).optional().or(z.literal("")),
    maxPerOrder: z.coerce.number().int().min(1, "จำนวนสูงสุดต่อออเดอร์ต้องอย่างน้อย 1").max(99, "จำนวนสูงสุดต่อออเดอร์ต้องไม่เกิน 99"),
})

interface ParsedVariant {
    name: string
    price: number | null
    stock: number | null
}

/**
 * อ่านแถวตัวเลือกสินค้าจากฟอร์ม — ทุกแถวส่งชื่อ field เดียวกัน จับคู่ตามลำดับ
 * (รูปแบบเดียวกับ parseCategories ของฟอร์มกิจกรรม)
 *
 * ช่องสต็อกว่าง = ไม่จำกัดจำนวน (null) ใช้กับพรีออเดอร์ที่ผลิตตามยอดสั่ง
 * ช่องราคาว่าง = ใช้ราคาของสินค้า
 */
function parseVariants(formData: FormData): { ok: true; rows: ParsedVariant[] } | { ok: false; error: string } {
    const names = formData.getAll("variant.name").map(String)
    const prices = formData.getAll("variant.price").map(String)
    const stocks = formData.getAll("variant.stock").map(String)

    const rows: ParsedVariant[] = []
    for (let i = 0; i < names.length; i++) {
        const name = names[i]?.trim()
        if (!name) continue // แถวว่างที่ผู้ใช้เพิ่มไว้แล้วไม่ได้กรอก — ข้ามไป ไม่ถือเป็นข้อผิดพลาด

        const priceRaw = prices[i]?.trim()
        const stockRaw = stocks[i]?.trim()

        const price = priceRaw ? Number(priceRaw) : null
        if (price !== null && (!Number.isFinite(price) || price < 0)) {
            return { ok: false, error: `ตัวเลือก "${name}": ราคาไม่ถูกต้อง` }
        }

        const stock = stockRaw ? Number(stockRaw) : null
        if (stock !== null && (!Number.isInteger(stock) || stock < 0)) {
            return { ok: false, error: `ตัวเลือก "${name}": จำนวนสต็อกไม่ถูกต้อง` }
        }

        if (rows.some((r) => r.name === name)) {
            return { ok: false, error: `ตัวเลือก "${name}" ซ้ำกัน` }
        }
        rows.push({ name, price, stock })
    }

    if (rows.length === 0) {
        return { ok: false, error: 'กรุณาเพิ่มตัวเลือกอย่างน้อย 1 รายการ (ถ้าไม่มีไซส์ให้ใส่ "มาตรฐาน")' }
    }
    return { ok: true, rows }
}

/** หา slug ที่ยังไม่ถูกใช้ — เติมเลขต่อท้ายถ้าชนกับของเดิม */
async function uniqueSlug(desired: string, excludeId?: string) {
    const base = slugify(desired) || `product-${Date.now()}`
    let candidate = base
    for (let i = 2; i < 50; i++) {
        const clash = await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } })
        if (!clash || clash.id === excludeId) return candidate
        candidate = `${base}-${i}`
    }
    return `${base}-${Date.now()}`
}

/** บันทึกรูปของหมวดหนึ่ง ต่อท้ายรูปที่มีอยู่ในหมวดเดียวกัน */
async function saveGroupImages(
    productId: string,
    category: ProductImageCategory,
    files: FormDataEntryValue[]
) {
    const existing = await prisma.productImage.count({ where: { productId, category } })
    let added = 0
    for (const file of files) {
        if (!(file instanceof File) || file.size === 0) continue
        const saved = await saveImage(file, "products")
        await prisma.productImage.create({
            data: {
                productId,
                category,
                url: saved.url,
                width: saved.width ?? null,
                height: saved.height ?? null,
                sortOrder: existing + added,
            },
        })
        added++
    }
    return added
}

/** บันทึกรูปทุกหมวดที่แนบมากับฟอร์มสร้างสินค้า */
async function saveProductGallery(productId: string, formData: FormData) {
    let total = 0
    for (const g of PRODUCT_IMAGE_GROUPS) {
        total += await saveGroupImages(productId, g.key, formData.getAll(productGroupField(g.key)))
    }
    return total
}

/** หมวดรูปที่ฟอร์มแนบมาจริง (ไฟล์ไม่ว่าง) — ใช้ตรวจก่อนสร้างสินค้า */
function attachedCategories(formData: FormData): ProductImageCategory[] {
    return PRODUCT_IMAGE_GROUPS.filter((g) =>
        formData.getAll(productGroupField(g.key)).some((f) => f instanceof File && f.size > 0)
    ).map((g) => g.key)
}

function parseProductForm(formData: FormData) {
    // ใช้ formString ทุกช่อง เพราะช่องพรีออเดอร์ไม่ถูกเรนเดอร์ตอนเลือก "สินค้าพร้อมส่ง"
    const get = (key: string) => formString(formData, key)
    return productSchema.safeParse({
        name: get("name"),
        slug: get("slug"),
        description: get("description"),
        type: get("type"),
        status: get("status"),
        price: get("price"),
        eventId: get("eventId"),
        preorderCloseAt: get("preorderCloseAt"),
        estimatedShipAt: get("estimatedShipAt"),
        preorderNote: get("preorderNote"),
        maxPerOrder: get("maxPerOrder"),
    })
}

function revalidateShop(slug?: string) {
    revalidatePath("/shop")
    revalidatePath("/admin/products")
    if (slug) revalidatePath(`/shop/${slug}`)
}

export async function createProduct(formData: FormData): Promise<ActionResult> {
    try {
        await requireAdminAction()
        const parsed = parseProductForm(formData)
        if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
        const d = parsed.data

        const variants = parseVariants(formData)
        if (!variants.ok) return { ok: false, error: variants.error }

        const allowPickup = formData.get("allowPickup") === "on"
        const allowShipping = formData.get("allowShipping") === "on"
        if (!allowPickup && !allowShipping) {
            return { ok: false, error: "ต้องเปิดวิธีรับของอย่างน้อย 1 วิธี" }
        }

        // สินค้าที่เปิดขายต้องมีรูปด้านหน้าและด้านหลังครบ — บันทึกเป็นร่างไว้ก่อนได้ถ้ายังไม่มีรูป
        if (d.status === "ACTIVE") {
            const missing = missingRequiredGroups(attachedCategories(formData))
            if (missing.length > 0) {
                return {
                    ok: false,
                    error: `สินค้าที่เปิดขายต้องมีรูป${missing.join("และ")} — แนบรูปให้ครบ หรือบันทึกเป็น "ร่าง" ไว้ก่อน`,
                }
            }
        }

        const slug = await uniqueSlug(d.slug || d.name)

        const product = await prisma.product.create({
            data: {
                slug,
                name: d.name,
                description: d.description,
                type: d.type,
                status: d.status,
                price: d.price,
                eventId: d.eventId || null,
                preorderCloseAt: d.type === "PREORDER" && d.preorderCloseAt ? new Date(d.preorderCloseAt) : null,
                estimatedShipAt: d.type === "PREORDER" && d.estimatedShipAt ? new Date(d.estimatedShipAt) : null,
                preorderNote: d.type === "PREORDER" ? d.preorderNote || null : null,
                allowPickup,
                allowShipping,
                maxPerOrder: d.maxPerOrder,
                variants: {
                    create: variants.rows.map((v, i) => ({
                        name: v.name,
                        price: v.price,
                        stock: v.stock,
                        sortOrder: i,
                    })),
                },
            },
        })

        await saveProductGallery(product.id, formData)

        revalidateShop(slug)
        return { ok: true, message: product.id }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "สร้างสินค้าไม่สำเร็จ" }
    }
}

export async function updateProduct(id: string, formData: FormData): Promise<ActionResult> {
    try {
        await requireAdminAction()
        const parsed = parseProductForm(formData)
        if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
        const d = parsed.data

        const allowPickup = formData.get("allowPickup") === "on"
        const allowShipping = formData.get("allowShipping") === "on"
        if (!allowPickup && !allowShipping) {
            return { ok: false, error: "ต้องเปิดวิธีรับของอย่างน้อย 1 วิธี" }
        }

        const current = await prisma.product.findUnique({ where: { id }, select: { slug: true } })
        if (!current) return { ok: false, error: "ไม่พบสินค้านี้" }

        // ตอนแก้ไข รูปถูกจัดการแยกที่แกลเลอรี จึงตรวจจากรูปที่มีอยู่จริงในฐานข้อมูล
        if (d.status === "ACTIVE") {
            const rows = await prisma.productImage.findMany({
                where: { productId: id },
                select: { category: true },
                distinct: ["category"],
            })
            const missing = missingRequiredGroups(rows.map((r) => r.category))
            if (missing.length > 0) {
                return {
                    ok: false,
                    error: `สินค้าที่เปิดขายต้องมีรูป${missing.join("และ")} — อัปโหลดที่หัวข้อ "รูปสินค้า" ด้านบนก่อน แล้วค่อยเปลี่ยนสถานะเป็นเปิดขาย`,
                }
            }
        }

        const slug = d.slug && d.slug !== current.slug ? await uniqueSlug(d.slug, id) : current.slug

        await prisma.product.update({
            where: { id },
            data: {
                slug,
                name: d.name,
                description: d.description,
                type: d.type,
                status: d.status,
                price: d.price,
                eventId: d.eventId || null,
                preorderCloseAt: d.type === "PREORDER" && d.preorderCloseAt ? new Date(d.preorderCloseAt) : null,
                estimatedShipAt: d.type === "PREORDER" && d.estimatedShipAt ? new Date(d.estimatedShipAt) : null,
                preorderNote: d.type === "PREORDER" ? d.preorderNote || null : null,
                allowPickup,
                allowShipping,
                maxPerOrder: d.maxPerOrder,
            },
        })

        revalidateShop(slug)
        if (current.slug !== slug) revalidatePath(`/shop/${current.slug}`)
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "บันทึกสินค้าไม่สำเร็จ" }
    }
}

/**
 * ลบสินค้า — ห้ามลบถ้ามีออเดอร์อ้างอิงอยู่ ให้เปลี่ยนสถานะเป็น "ซ่อน" แทน
 * (OrderItem เก็บชื่อ/ราคาไว้เป็น snapshot แล้ว แต่การลบทำให้ตามรอยกลับมาไม่ได้)
 */
export async function deleteProduct(id: string): Promise<ActionResult> {
    try {
        await requireAdminAction()

        const used = await prisma.orderItem.count({ where: { productId: id } })
        if (used > 0) {
            return { ok: false, error: `สินค้านี้มีในออเดอร์แล้ว ${used} รายการ ลบไม่ได้ — ใช้สถานะ "ซ่อน" แทน` }
        }

        const product = await prisma.product.findUnique({ where: { id }, select: { slug: true } })
        await prisma.product.delete({ where: { id } })

        revalidateShop(product?.slug)
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "ลบสินค้าไม่สำเร็จ" }
    }
}

export async function addProductImages(
    productId: string,
    category: string,
    formData: FormData
): Promise<ActionResult> {
    try {
        await requireAdminAction()
        if (!isProductImageCategory(category)) return { ok: false, error: "หมวดรูปไม่ถูกต้อง" }

        const added = await saveGroupImages(productId, category, formData.getAll(productGroupField(category)))
        if (added === 0) return { ok: false, error: "กรุณาเลือกรูปอย่างน้อย 1 ไฟล์" }

        const product = await prisma.product.findUnique({ where: { id: productId }, select: { slug: true } })
        revalidateShop(product?.slug)
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "อัปโหลดรูปไม่สำเร็จ" }
    }
}

export async function deleteProductImage(id: string): Promise<ActionResult> {
    try {
        await requireAdminAction()

        const image = await prisma.productImage.findUnique({
            where: { id },
            select: {
                productId: true,
                category: true,
                product: { select: { slug: true, status: true } },
            },
        })
        if (!image) return { ok: false, error: "ไม่พบรูปนี้" }

        // กันลบรูปบังคับรูปสุดท้ายทิ้งทั้งที่สินค้ายังเปิดขายอยู่ — หน้าร้านจะเหลือช่องว่าง
        const group = PRODUCT_IMAGE_GROUPS.find((g) => g.key === image.category)
        if (group?.required && image.product.status === "ACTIVE") {
            const left = await prisma.productImage.count({
                where: { productId: image.productId, category: image.category },
            })
            if (left <= 1) {
                return {
                    ok: false,
                    error: `สินค้านี้เปิดขายอยู่ ต้องมีรูป${group.label}อย่างน้อย 1 รูป — อัปโหลดรูปใหม่ก่อน หรือเปลี่ยนสถานะเป็นซ่อน/ร่างแล้วค่อยลบ`,
                }
            }
        }

        await prisma.productImage.delete({ where: { id } })

        revalidateShop(image.product.slug)
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "ลบรูปไม่สำเร็จ" }
    }
}

/** สลับลำดับรูปกับตัวที่อยู่ก่อน/หลัง — เรียงภายในหมวดเดียวกันเท่านั้น */
export async function moveProductImage(id: string, direction: "up" | "down"): Promise<ActionResult> {
    try {
        await requireAdminAction()

        const image = await prisma.productImage.findUnique({ where: { id } })
        if (!image) return { ok: false, error: "ไม่พบรูปนี้" }

        const neighbour = await prisma.productImage.findFirst({
            where: {
                productId: image.productId,
                category: image.category,
                sortOrder: direction === "up" ? { lt: image.sortOrder } : { gt: image.sortOrder },
            },
            orderBy: { sortOrder: direction === "up" ? "desc" : "asc" },
        })
        if (!neighbour) return { ok: true } // อยู่สุดขอบแล้ว ไม่ถือเป็นข้อผิดพลาด

        await prisma.$transaction([
            prisma.productImage.update({ where: { id: image.id }, data: { sortOrder: neighbour.sortOrder } }),
            prisma.productImage.update({ where: { id: neighbour.id }, data: { sortOrder: image.sortOrder } }),
        ])

        const product = await prisma.product.findUnique({
            where: { id: image.productId },
            select: { slug: true },
        })
        revalidateShop(product?.slug)
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "ย้ายรูปไม่สำเร็จ" }
    }
}

const variantSchema = z.object({
    name: z.string().trim().min(1, "กรุณากรอกชื่อตัวเลือก").max(80),
    price: z.string().optional().or(z.literal("")),
    stock: z.string().optional().or(z.literal("")),
})

export async function createVariant(formData: FormData): Promise<ActionResult> {
    try {
        await requireAdminAction()

        const productId = String(formData.get("productId") ?? "")
        const parsed = variantSchema.safeParse({
            name: formData.get("name"),
            price: formData.get("price"),
            stock: formData.get("stock"),
        })
        if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
        const d = parsed.data

        const product = await prisma.product.findUnique({ where: { id: productId }, select: { slug: true } })
        if (!product) return { ok: false, error: "ไม่พบสินค้านี้" }

        const last = await prisma.productVariant.findFirst({
            where: { productId },
            orderBy: { sortOrder: "desc" },
            select: { sortOrder: true },
        })

        await prisma.productVariant.create({
            data: {
                productId,
                name: d.name,
                price: d.price?.trim() ? Number(d.price) : null,
                stock: d.stock?.trim() ? Number(d.stock) : null,
                sortOrder: (last?.sortOrder ?? -1) + 1,
            },
        })

        revalidateShop(product.slug)
        return { ok: true }
    } catch (e) {
        const message = e instanceof Error && e.message.includes("Unique constraint")
            ? "มีตัวเลือกชื่อนี้อยู่แล้ว"
            : e instanceof Error ? e.message : "เพิ่มตัวเลือกไม่สำเร็จ"
        return { ok: false, error: message }
    }
}

/** แก้ราคา/สต็อก/เปิด-ปิดขายของตัวเลือกหนึ่ง — ใช้ปรับสต็อกหน้าร้านเป็นหลัก */
export async function updateVariant(id: string, formData: FormData): Promise<ActionResult> {
    try {
        await requireAdminAction()

        const parsed = variantSchema.safeParse({
            name: formData.get("name"),
            price: formData.get("price"),
            stock: formData.get("stock"),
        })
        if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
        const d = parsed.data

        const variant = await prisma.productVariant.findUnique({
            where: { id },
            select: { product: { select: { slug: true } } },
        })
        if (!variant) return { ok: false, error: "ไม่พบตัวเลือกนี้" }

        const stock = d.stock?.trim() ? Number(d.stock) : null
        if (stock !== null && (!Number.isInteger(stock) || stock < 0)) {
            return { ok: false, error: "จำนวนสต็อกไม่ถูกต้อง" }
        }

        await prisma.productVariant.update({
            where: { id },
            data: {
                name: d.name,
                price: d.price?.trim() ? Number(d.price) : null,
                stock,
                active: formData.get("active") === "on",
            },
        })

        revalidateShop(variant.product.slug)
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "บันทึกตัวเลือกไม่สำเร็จ" }
    }
}

export async function deleteVariant(id: string): Promise<ActionResult> {
    try {
        await requireAdminAction()

        const variant = await prisma.productVariant.findUnique({
            where: { id },
            select: { productId: true, product: { select: { slug: true } } },
        })
        if (!variant) return { ok: false, error: "ไม่พบตัวเลือกนี้" }

        // สินค้าต้องเหลืออย่างน้อย 1 ตัวเลือกเสมอ ไม่งั้นจะกดซื้อไม่ได้เลย
        const count = await prisma.productVariant.count({ where: { productId: variant.productId } })
        if (count <= 1) return { ok: false, error: "สินค้าต้องมีอย่างน้อย 1 ตัวเลือก" }

        const used = await prisma.orderItem.count({ where: { variantId: id } })
        if (used > 0) {
            return { ok: false, error: `ตัวเลือกนี้มีในออเดอร์แล้ว ลบไม่ได้ — ปิดการขายแทนได้` }
        }

        await prisma.productVariant.delete({ where: { id } })

        revalidateShop(variant.product.slug)
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "ลบตัวเลือกไม่สำเร็จ" }
    }
}

const statusSchema = z.object({
    status: z.enum(["PENDING", "PAID", "PREPARING", "SHIPPED", "COMPLETED", "CANCELLED", "EXPIRED", "REFUNDED"]),
    trackingNo: z.string().trim().max(60).optional().or(z.literal("")),
    adminNote: z.string().trim().max(400).optional().or(z.literal("")),
})

/**
 * แอดมินเปลี่ยนสถานะออเดอร์ / ใส่เลขพัสดุ
 *
 * การเปลี่ยนไปเป็น CANCELLED หรือ REFUNDED ต้องคืนสต็อกด้วย จึงส่งต่อให้ releaseOrder
 * ซึ่งคืนสต็อกแบบกันคืนซ้ำไว้แล้ว ไม่ใช่ update ตรงๆ
 */
export async function updateOrderStatus(orderId: string, formData: FormData): Promise<ActionResult> {
    try {
        await requireAdminAction()

        const parsed = statusSchema.safeParse({
            status: formData.get("status"),
            trackingNo: formData.get("trackingNo"),
            adminNote: formData.get("adminNote"),
        })
        if (!parsed.success) return { ok: false, error: "สถานะไม่ถูกต้อง" }
        const d = parsed.data

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true, user: { select: { email: true } } },
        })
        if (!order) return { ok: false, error: "ไม่พบออเดอร์นี้" }

        if (d.status !== order.status && (d.status === "CANCELLED" || d.status === "REFUNDED")) {
            // คืนสต็อกเฉพาะออเดอร์ที่ยังจองของอยู่ ออเดอร์ที่หมดอายุ/ยกเลิกไปแล้วคืนไปแล้ว
            const done = await releaseOrder(
                orderId,
                d.status,
                ["PENDING", "PAID", "PREPARING", "SHIPPED", "COMPLETED"],
                d.adminNote || undefined
            )
            if (!done) return { ok: false, error: "ออเดอร์นี้ถูกเปลี่ยนสถานะไปแล้ว" }
        } else {
            await prisma.order.update({
                where: { id: orderId },
                data: {
                    status: d.status,
                    trackingNo: d.trackingNo || null,
                    adminNote: d.adminNote || null,
                    ...(d.status === "SHIPPED" ? { shippedAt: new Date() } : {}),
                    ...(d.status === "COMPLETED" ? { pickedUpAt: new Date() } : {}),
                },
            })
        }

        // เลขพัสดุอัปเดตได้เสมอ แม้สถานะไม่เปลี่ยน
        if (d.status === "CANCELLED" || d.status === "REFUNDED") {
            await prisma.order.update({
                where: { id: orderId },
                data: { trackingNo: d.trackingNo || null },
            })
        }

        // แจ้งลูกค้าเมื่อเพิ่งเปลี่ยนเป็น "จัดส่งแล้ว" — ไม่ส่งซ้ำถ้าสถานะเดิมก็ SHIPPED อยู่แล้ว
        if (d.status === "SHIPPED" && order.status !== "SHIPPED") {
            await sendOrderShippedEmail(order.user.email, {
                id: order.id,
                orderNo: order.orderNo,
                total: order.total,
                shippingFee: order.shippingFee,
                deliveryMethod: order.deliveryMethod,
                trackingNo: d.trackingNo || order.trackingNo,
                items: order.items,
            })
        }

        revalidatePath("/admin/orders")
        revalidatePath(`/admin/orders/${orderId}`)
        revalidatePath(`/orders/${orderId}`)
        revalidatePath("/orders")
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "อัปเดตสถานะไม่สำเร็จ" }
    }
}

const settingSchema = z.object({
    shippingBaseFee: z.coerce.number().min(0, "ค่าส่งต้องไม่ติดลบ"),
    shippingExtraPerItem: z.coerce.number().min(0, "ค่าส่งชิ้นถัดไปต้องไม่ติดลบ"),
    pickupLocation: z.string().trim().max(500).optional().or(z.literal("")),
    announcement: z.string().trim().max(500).optional().or(z.literal("")),
})

export async function updateShopSetting(formData: FormData): Promise<ActionResult> {
    try {
        await requireAdminAction()

        const parsed = settingSchema.safeParse({
            shippingBaseFee: formData.get("shippingBaseFee"),
            shippingExtraPerItem: formData.get("shippingExtraPerItem"),
            pickupLocation: formData.get("pickupLocation"),
            announcement: formData.get("announcement"),
        })
        if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
        const d = parsed.data

        const data = {
            shippingBaseFee: d.shippingBaseFee,
            shippingExtraPerItem: d.shippingExtraPerItem,
            pickupLocation: d.pickupLocation || null,
            announcement: d.announcement || null,
        }

        await prisma.shopSetting.upsert({
            where: { id: "default" },
            update: data,
            create: { id: "default", ...data },
        })

        revalidatePath("/admin/shop")
        revalidatePath("/checkout")
        revalidatePath("/cart")
        return { ok: true, message: "บันทึกแล้ว" }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "บันทึกการตั้งค่าไม่สำเร็จ" }
    }
}

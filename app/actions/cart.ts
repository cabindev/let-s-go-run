'use server'

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireUserAction } from "@/lib/auth-helpers"
import { getOrCreateCart } from "@/lib/cart"
import { maxOrderable, purchasableState } from "@/lib/shop"
import type { ActionResult } from "./registration"

/** จำนวนรายการสูงสุดในตะกร้า — กันยิงเพิ่มรัวๆ จนหน้าเว็บและทรานแซกชันตอนสั่งบวม */
const MAX_CART_LINES = 30

const addSchema = z.object({
    variantId: z.string().min(1),
    quantity: z.coerce.number().int().min(1).max(99),
})

function revalidateCart() {
    revalidatePath("/cart")
    revalidatePath("/checkout")
}

/**
 * ใส่สินค้าลงตะกร้า (ถ้ามีอยู่แล้วให้บวกจำนวนเพิ่ม)
 *
 * client ส่งมาได้แค่ variantId กับจำนวนเท่านั้น — ราคา ชื่อ และเพดานจำนวนอ่านจาก DB ทั้งหมด
 */
export async function addToCart(variantId: string, quantity: number): Promise<ActionResult> {
    try {
        const user = await requireUserAction()

        const parsed = addSchema.safeParse({ variantId, quantity })
        if (!parsed.success) return { ok: false, error: "จำนวนไม่ถูกต้อง" }

        const variant = await prisma.productVariant.findUnique({
            where: { id: parsed.data.variantId },
            include: { product: true },
        })
        if (!variant) return { ok: false, error: "ไม่พบสินค้านี้" }

        // ตรวจสถานะสินค้าที่นี่ และตรวจซ้ำอีกรอบตอนกดสั่งจริง (placeOrder)
        // เพราะของอาจถูกปิดขาย/หมดระหว่างที่ค้างอยู่ในตะกร้า
        const state = purchasableState(variant.product)
        if (!state.ok) return { ok: false, error: state.reason }
        if (!variant.active) return { ok: false, error: "ตัวเลือกนี้ปิดการขายแล้ว" }

        const max = maxOrderable(variant.product, variant)
        if (max <= 0) return { ok: false, error: "สินค้าหมดแล้ว" }

        const cart = await getOrCreateCart(user.id)
        const existing = cart.items.find((i) => i.variantId === variant.id)

        if (!existing && cart.items.length >= MAX_CART_LINES) {
            return { ok: false, error: `ใส่ตะกร้าได้สูงสุด ${MAX_CART_LINES} รายการ` }
        }

        const wanted = (existing?.quantity ?? 0) + parsed.data.quantity
        if (wanted > max) {
            return {
                ok: false,
                error: existing
                    ? `มีในตะกร้าแล้ว ${existing.quantity} ชิ้น สั่งรวมได้สูงสุด ${max} ชิ้น`
                    : `สั่งได้สูงสุด ${max} ชิ้น`,
            }
        }

        await prisma.cartItem.upsert({
            where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
            update: { quantity: wanted },
            create: { cartId: cart.id, variantId: variant.id, quantity: parsed.data.quantity },
        })

        revalidateCart()
        return { ok: true, message: "ใส่ตะกร้าแล้ว" }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "ใส่ตะกร้าไม่สำเร็จ" }
    }
}

/** แก้จำนวนของรายการในตะกร้า */
export async function updateCartItem(itemId: string, quantity: number): Promise<ActionResult> {
    try {
        const user = await requireUserAction()

        const parsed = z.coerce.number().int().min(1).max(99).safeParse(quantity)
        if (!parsed.success) return { ok: false, error: "จำนวนไม่ถูกต้อง" }

        // ผูก userId เข้าไปในเงื่อนไขด้วย — กันแก้ตะกร้าของคนอื่นด้วยการเดา id
        const item = await prisma.cartItem.findFirst({
            where: { id: itemId, cart: { userId: user.id } },
            include: { variant: { include: { product: true } } },
        })
        if (!item) return { ok: false, error: "ไม่พบรายการนี้ในตะกร้า" }

        const max = maxOrderable(item.variant.product, item.variant)
        if (max <= 0) return { ok: false, error: "สินค้าหมดแล้ว" }
        if (parsed.data > max) return { ok: false, error: `สั่งได้สูงสุด ${max} ชิ้น` }

        await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: parsed.data } })

        revalidateCart()
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "แก้จำนวนไม่สำเร็จ" }
    }
}

export async function removeCartItem(itemId: string): Promise<ActionResult> {
    try {
        const user = await requireUserAction()

        const { count } = await prisma.cartItem.deleteMany({
            where: { id: itemId, cart: { userId: user.id } },
        })
        if (count === 0) return { ok: false, error: "ไม่พบรายการนี้ในตะกร้า" }

        revalidateCart()
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "ลบไม่สำเร็จ" }
    }
}

export async function clearCart(): Promise<ActionResult> {
    try {
        const user = await requireUserAction()
        await prisma.cartItem.deleteMany({ where: { cart: { userId: user.id } } })

        revalidateCart()
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "ล้างตะกร้าไม่สำเร็จ" }
    }
}

'use server'

import { z } from "zod"
import { Prisma } from "@prisma/client"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { requireUserAction } from "@/lib/auth-helpers"
import { amountWithFee, FEE_LABEL, type PaymentMethodChoice } from "@/lib/checkout-fees"
import { buildCartLines, getCart, groupByType, summarizeGroup, allowedDelivery } from "@/lib/cart"
import {
    generateOrderNo,
    getShopSetting,
    orderDeadline,
    ORDER_PAYABLE_STATUS,
    PRODUCT_TYPE_LABEL,
    purchasableState,
    SHOP_NAME,
    variantPrice,
} from "@/lib/shop"
import { expireStaleOrders, isOrderExpired, releaseOrder } from "@/lib/order-stock"
import { sendOrderPlacedEmail } from "@/lib/mail"
import { formString } from "@/lib/utils"
import type { ActionResult } from "./registration"

const checkoutSchema = z.object({
    deliveryMethod: z.enum(["PICKUP", "SHIPPING"]),
    recipientName: z.string().trim().max(120).optional().or(z.literal("")),
    recipientPhone: z.string().trim().max(20).optional().or(z.literal("")),
    address: z.string().trim().max(400).optional().or(z.literal("")),
    province: z.string().trim().max(60).optional().or(z.literal("")),
    postalCode: z.string().trim().max(10).optional().or(z.literal("")),
    customerNote: z.string().trim().max(400).optional().or(z.literal("")),
    // ยอดที่ผู้ซื้อเห็นบนหน้าจอ — ใช้ "เทียบยืนยัน" เท่านั้น ไม่เคยเอาไปคิดเงิน
    expectedTotal: z.coerce.number().optional(),
})

export type PlaceOrderResult =
    | { ok: true; orderIds: string[] }
    | { ok: false; error: string }

/**
 * ยืนยันการสั่งซื้อ — จุดที่ต้องแน่นที่สุดของระบบร้านค้า
 *
 * หลักการ: ทุกยอดคำนวณใหม่ฝั่ง server จากฐานข้อมูลเสมอ ฝั่ง client ส่งได้แค่วิธีรับของ
 * กับที่อยู่ ส่วนราคา/จำนวนเงิน/ค่าส่ง ไม่เคยเชื่อค่าที่ส่งมา
 *
 * สินค้าพร้อมส่งกับพรีออเดอร์ถูกแยกเป็นคนละออเดอร์ เพราะรอบจัดส่งต่างกัน
 * แต่ละใบมีค่าส่ง เลขพัสดุ และสถานะของตัวเอง
 */
export async function placeOrder(formData: FormData): Promise<PlaceOrderResult> {
    try {
        const user = await requireUserAction()

        // ปล่อยสต็อกของออเดอร์ที่หมดเวลาก่อน จะได้นับของว่างตามจริง
        await expireStaleOrders()

        // ช่องที่อยู่ไม่ถูกเรนเดอร์ตอนเลือก "รับเอง" จึงต้องอ่านผ่าน formString
        const get = (key: string) => formString(formData, key)
        const parsed = checkoutSchema.safeParse({
            deliveryMethod: get("deliveryMethod"),
            recipientName: get("recipientName"),
            recipientPhone: get("recipientPhone"),
            address: get("address"),
            province: get("province"),
            postalCode: get("postalCode"),
            customerNote: get("customerNote"),
            expectedTotal: get("expectedTotal") || undefined,
        })
        if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง" }
        const d = parsed.data

        if (formData.get("pdpaConsent") !== "1") {
            return { ok: false, error: "กรุณายอมรับเงื่อนไขการเก็บข้อมูลก่อนสั่งซื้อ" }
        }

        const cart = await getCart(user.id)
        if (!cart || cart.items.length === 0) return { ok: false, error: "ตะกร้าว่างเปล่า" }

        const lines = buildCartLines(cart)
        const blocked = lines.find((l) => l.issue)
        if (blocked) return { ok: false, error: blocked.issue! }

        // วิธีรับของต้องเป็นวิธีที่ "ทุกชิ้น" ในตะกร้ารองรับ
        const allowed = allowedDelivery(lines)
        if (d.deliveryMethod === "SHIPPING" && !allowed.shipping) {
            return { ok: false, error: "มีสินค้าในตะกร้าที่ไม่รองรับการจัดส่งทางไปรษณีย์" }
        }
        if (d.deliveryMethod === "PICKUP" && !allowed.pickup) {
            return { ok: false, error: "มีสินค้าในตะกร้าที่ต้องจัดส่งทางไปรษณีย์เท่านั้น" }
        }

        if (d.deliveryMethod === "SHIPPING") {
            if (!d.recipientName) return { ok: false, error: "กรุณากรอกชื่อผู้รับ" }
            if (!d.recipientPhone) return { ok: false, error: "กรุณากรอกเบอร์โทรผู้รับ" }
            if (!d.address) return { ok: false, error: "กรุณากรอกที่อยู่จัดส่ง" }
            if (!d.province) return { ok: false, error: "กรุณาเลือกจังหวัด" }
            if (!/^\d{5}$/.test(d.postalCode ?? "")) return { ok: false, error: "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก" }
        }

        const setting = await getShopSetting()
        const groups = groupByType(lines).map((g) =>
            summarizeGroup(g.type, g.lines, d.deliveryMethod, setting)
        )
        const grandTotal = groups.reduce((s, g) => s + g.total, 0)

        // ราคาอาจถูกแอดมินแก้ระหว่างที่ของค้างในตะกร้า — ถ้ายอดไม่ตรงกับที่ผู้ซื้อเห็น
        // ให้ตีกลับไปดูใหม่ ไม่ตัดเงินตามยอดที่เปลี่ยนไปเงียบๆ
        if (d.expectedTotal !== undefined && Math.abs(d.expectedTotal - grandTotal) > 0.01) {
            return { ok: false, error: "ราคาสินค้ามีการเปลี่ยนแปลง กรุณาตรวจสอบยอดรวมอีกครั้งก่อนยืนยัน" }
        }

        const shippingSnapshot =
            d.deliveryMethod === "SHIPPING"
                ? {
                    recipientName: d.recipientName || null,
                    recipientPhone: d.recipientPhone || null,
                    address: d.address || null,
                    province: d.province || null,
                    postalCode: d.postalCode || null,
                }
                : {
                    recipientName: d.recipientName || user.name || null,
                    recipientPhone: d.recipientPhone || null,
                    address: null,
                    province: null,
                    postalCode: null,
                }

        const variantIds = [...new Set(lines.map((l) => l.variantId))].sort()

        const outcome = await prisma.$transaction(async (tx) => {
            // ล็อกแถวตัวเลือกสินค้าทั้งหมดก่อน เรียงตาม id เพื่อให้ทุกทรานแซกชันล็อกลำดับ
            // เดียวกัน (กัน deadlock ตอนคนสองคนสั่งสินค้าชุดเดียวกันคนละลำดับพร้อมกัน)
            await tx.$queryRaw`
                SELECT id FROM ProductVariant
                WHERE id IN (${Prisma.join(variantIds)})
                ORDER BY id
                FOR UPDATE`

            // อ่านของจริงอีกรอบ "หลังล็อกแล้ว" — ค่าก่อนหน้านี้อาจเก่าไปแล้ว
            const fresh = await tx.productVariant.findMany({
                where: { id: { in: variantIds } },
                include: { product: true },
            })
            const byId = new Map(fresh.map((v) => [v.id, v]))

            for (const line of lines) {
                const v = byId.get(line.variantId)
                if (!v || !v.active) return { ok: false as const, error: `"${line.variantName}" ปิดการขายแล้ว` }

                const state = purchasableState(v.product)
                if (!state.ok) return { ok: false as const, error: `${v.product.name}: ${state.reason}` }

                // ราคาต้องยังตรงกับที่คิดไว้ตอนสรุปยอด (กันแก้ราคาแทรกกลางทาง)
                if (variantPrice(v.product, v) !== line.unitPrice) {
                    return { ok: false as const, error: "ราคาสินค้ามีการเปลี่ยนแปลง กรุณาตรวจสอบยอดรวมอีกครั้ง" }
                }

                // ตัดสต็อกแบบมีเงื่อนไข — ถ้าของเหลือไม่พอ count จะเป็น 0 แล้ว rollback ทั้งก้อน
                // (stock = null คือไม่จำกัด ไม่ต้องตัด)
                if (v.stock !== null) {
                    const { count } = await tx.productVariant.updateMany({
                        where: { id: v.id, stock: { gte: line.quantity } },
                        data: { stock: { decrement: line.quantity } },
                    })
                    if (count !== 1) {
                        return { ok: false as const, error: `"${v.product.name} · ${v.name}" เหลือไม่พอแล้ว` }
                    }
                }
            }

            const expiresAt = orderDeadline()
            const orderIds: string[] = []

            for (const group of groups) {
                const needsPayment = group.total > 0

                let orderNo = generateOrderNo()
                for (let i = 0; i < 8; i++) {
                    const clash = await tx.order.findUnique({ where: { orderNo }, select: { id: true } })
                    if (!clash) break
                    orderNo = generateOrderNo()
                }

                const order = await tx.order.create({
                    data: {
                        orderNo,
                        userId: user.id,
                        type: group.type,
                        status: needsPayment ? "PENDING" : "PAID",
                        subtotal: group.subtotal,
                        shippingFee: group.shippingFee,
                        total: group.total,
                        deliveryMethod: d.deliveryMethod,
                        ...shippingSnapshot,
                        customerNote: d.customerNote || null,
                        expiresAt: needsPayment ? expiresAt : null,
                        paidAt: needsPayment ? null : new Date(),
                        pdpaConsentAt: new Date(),
                        items: {
                            create: group.lines.map((l) => ({
                                productId: l.productId,
                                variantId: l.variantId,
                                productName: l.productName,
                                variantName: l.variantName,
                                unitPrice: l.unitPrice,
                                quantity: l.quantity,
                                lineTotal: l.lineTotal,
                            })),
                        },
                    },
                    select: { id: true },
                })
                orderIds.push(order.id)
            }

            // ล้างตะกร้าในทรานแซกชันเดียวกัน — ถ้าสร้างออเดอร์ล้มเหลว ของต้องยังอยู่ในตะกร้า
            await tx.cartItem.deleteMany({ where: { cartId: cart.id } })

            return { ok: true as const, orderIds }
        })

        if (!outcome.ok) return { ok: false, error: outcome.error }

        // อีเมลยืนยันส่งหลังทรานแซกชันจบแล้ว และห้ามทำให้คำสั่งซื้อล้มถ้าส่งไม่ออก
        // (safeSend กลืน error ให้อยู่แล้ว ตรงนี้กันอีกชั้นเผื่ออ่านข้อมูลพลาด)
        try {
            const created = await prisma.order.findMany({
                where: { id: { in: outcome.orderIds } },
                include: { items: true },
            })
            for (const o of created) {
                await sendOrderPlacedEmail(user.email ?? "", {
                    id: o.id,
                    orderNo: o.orderNo,
                    total: o.total,
                    shippingFee: o.shippingFee,
                    deliveryMethod: o.deliveryMethod,
                    expiresAt: o.expiresAt,
                    items: o.items,
                })
            }
        } catch (e) {
            console.error("[order] ส่งอีเมลยืนยันคำสั่งซื้อไม่สำเร็จ:", e)
        }

        revalidatePath("/cart")
        revalidatePath("/orders")
        revalidatePath("/shop")

        return { ok: true, orderIds: outcome.orderIds }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "สั่งซื้อไม่สำเร็จ" }
    }
}

/** ผู้ซื้อยกเลิกออเดอร์ของตัวเอง — ทำได้เฉพาะตอนที่ยังไม่ได้ชำระเงิน */
export async function cancelOrder(orderId: string): Promise<ActionResult> {
    try {
        const user = await requireUserAction()

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: { userId: true, status: true },
        })
        if (!order || order.userId !== user.id) return { ok: false, error: "ไม่พบออเดอร์นี้" }
        if (order.status !== "PENDING") return { ok: false, error: "ออเดอร์นี้ยกเลิกไม่ได้แล้ว" }

        const done = await releaseOrder(orderId, "CANCELLED", ["PENDING"], "ผู้ซื้อยกเลิกเอง")
        if (!done) return { ok: false, error: "ออเดอร์นี้ถูกเปลี่ยนสถานะไปแล้ว" }

        revalidatePath("/orders")
        revalidatePath(`/orders/${orderId}`)
        revalidatePath("/shop")
        return { ok: true, message: "ยกเลิกออเดอร์แล้ว" }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "ยกเลิกไม่สำเร็จ" }
    }
}

/**
 * สร้าง Stripe Checkout Session ของออเดอร์แล้วพาไปหน้าชำระเงิน
 * ล้อ createCheckoutSession ของฝั่งสมัครวิ่ง — ผู้จ่ายรับภาระค่าธรรมเนียม Stripe
 */
export async function createOrderCheckoutSession(
    orderId: string,
    method: PaymentMethodChoice
): Promise<ActionResult> {
    let checkoutUrl: string
    try {
        const user = await requireUserAction()

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true },
        })

        if (!order || order.userId !== user.id) return { ok: false, error: "ไม่พบออเดอร์นี้" }
        if (!ORDER_PAYABLE_STATUS.includes(order.status)) return { ok: false, error: "ออเดอร์นี้ชำระเงินไม่ได้แล้ว" }
        if (isOrderExpired(order)) return { ok: false, error: "หมดเวลาชำระเงินแล้ว กรุณาสั่งซื้อใหม่อีกครั้ง" }
        if (order.total <= 0) return { ok: false, error: "ออเดอร์นี้ไม่มีค่าใช้จ่าย" }

        // ยอดคิดจาก order.total ที่ server บันทึกไว้ตอนสั่งเท่านั้น
        const total = amountWithFee(order.total, method)
        const origin = process.env.NEXTAUTH_URL || "http://localhost:3000"
        const itemCount = order.items.reduce((s, i) => s + i.quantity, 0)
        const productName =
            `${SHOP_NAME} · ${PRODUCT_TYPE_LABEL[order.type]} ${itemCount} ชิ้น (${order.orderNo})` +
            (order.deliveryMethod === "SHIPPING" ? " รวมค่าส่งไปรษณีย์" : "")

        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            excluded_payment_method_types: [method === "card" ? "promptpay" : "card"],
            branding_settings: { display_name: "RunLudtong", button_color: "#E11D48", border_style: "pill" },
            customer_email: user.email ?? undefined,
            client_reference_id: order.id,
            // kind บอก webhook ว่าเป็นสายร้านค้า ไม่ใช่สายสมัครวิ่ง
            metadata: { kind: "order", orderId: order.id, baseAmount: String(order.total), paymentMethodChoice: method },
            line_items: [
                {
                    quantity: 1,
                    price_data: {
                        currency: "thb",
                        unit_amount: Math.round(total * 100),
                        product_data: { name: `${productName} (รวมค่าธรรมเนียม ${FEE_LABEL[method]})` },
                    },
                },
            ],
            success_url: `${origin}/orders/${order.id}?checkout=success`,
            cancel_url: `${origin}/orders/${order.id}?checkout=cancel`,
        })

        if (!session.url) return { ok: false, error: "สร้างรายการชำระเงินไม่สำเร็จ" }

        await prisma.order.update({
            where: { id: order.id },
            data: { stripeSessionId: session.id },
        })

        checkoutUrl = session.url
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "สร้างรายการชำระเงินไม่สำเร็จ" }
    }

    // redirect โยน error ออกมา จึงต้องอยู่นอก try (แบบเดียวกับ app/actions/checkout.ts)
    redirect(checkoutUrl)
}

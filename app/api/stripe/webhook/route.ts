import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { withBib } from "@/lib/vr"
import { recalculateUserStats } from "@/lib/stats"
import { unlockAchievements } from "@/lib/achievements"
import { PAYABLE_STATUS } from "@/lib/expiry"
import {
    sendOrderPaidEmail,
    sendPaymentIssueAlert,
    sendPaymentIssueCustomerEmail,
    sendRegistrationPaidEmail,
    sendRegistrationIssueAlert,
    sendRegistrationIssueCustomerEmail,
    type MailOrder,
} from "@/lib/mail"
import { registrationAmount } from "@/lib/events"

export const dynamic = "force-dynamic"

/** แปลงออเดอร์จากฐานข้อมูลให้เหลือเฉพาะที่อีเมลต้องใช้ */
function toMailOrder(order: {
    id: string
    orderNo: string
    total: number
    shippingFee: number
    deliveryMethod: "PICKUP" | "SHIPPING"
    trackingNo: string | null
    expiresAt: Date | null
    items: { productName: string; variantName: string; quantity: number; lineTotal: number }[]
}): MailOrder {
    return {
        id: order.id,
        orderNo: order.orderNo,
        total: order.total,
        shippingFee: order.shippingFee,
        deliveryMethod: order.deliveryMethod,
        trackingNo: order.trackingNo,
        expiresAt: order.expiresAt,
        items: order.items,
    }
}

/** เช็ควิธีจ่ายจริง (บัตร/PromptPay) และดึงลิงก์ใบเสร็จที่ Stripe ออกให้อัตโนมัติจาก payment intent เดียวกัน */
async function resolvePayment(paymentIntentId: string | null): Promise<{ method: string | null; receiptUrl: string | null }> {
    if (!paymentIntentId) return { method: null, receiptUrl: null }
    try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["payment_method", "latest_charge"] })
        const pm = pi.payment_method
        const method = typeof pm === "string" ? null : (pm?.type ?? null)
        const charge = pi.latest_charge
        const receiptUrl = typeof charge === "string" ? null : (charge?.receipt_url ?? null)
        return { method, receiptUrl }
    } catch {
        return { method: null, receiptUrl: null }
    }
}

/** ยืนยันการชำระเงินจาก Stripe → PAID */
async function markRegistrationPaid(registrationId: string, session: Stripe.Checkout.Session) {
    const reg = await prisma.registration.findUnique({
        where: { id: registrationId },
        include: {
            user: { select: { email: true } },
            event: { select: { title: true, date: true, price: true } },
            category: { select: { name: true, price: true } },
        },
    })
    if (!reg) return

    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null

    // ถ้าถูกยกเลิก/หมดเวลาไปแล้วระหว่างที่จ่ายเงินค้างอยู่ (เช่น ผู้ใช้กดยกเลิกเอง หรือระบบ sweep
    // ที่นั่งคืนให้คนอื่นไปแล้ว) ห้ามดันกลับเป็น PAID เพราะจะทำให้ที่นั่งถูกจองซ้อนเกินโควตา
    //
    // แต่ก็ห้ามเงียบด้วย — เงินเข้าจริงแล้วแต่ผู้สมัครไม่ได้ที่นั่ง ต้องปักธงให้ผู้จัดตามเรื่อง
    // (กติกาเดียวกับฝั่งร้านค้า ดู markOrderPaid)
    if (!PAYABLE_STATUS.includes(reg.status)) {
        if (reg.status === "PAID" || reg.paymentIssueAt) return

        const { method, receiptUrl: rUrl } = await resolvePayment(paymentIntentId)
        const amount = registrationAmount(reg.category?.price ?? reg.event.price, reg.deliveryMethod)

        await prisma.registration.update({
            where: { id: registrationId },
            data: {
                paymentIssueAt: new Date(),
                stripeSessionId: session.id,
                stripePaymentIntentId: paymentIntentId,
                paymentMethod: method,
                receiptUrl: rUrl,
                note: `เงินเข้าแล้วแต่ใบสมัครอยู่ในสถานะ ${reg.status} — ต้องคืนเงินหรือคืนที่นั่งให้ผู้สมัคร`,
            },
        })

        await sendRegistrationIssueAlert({
            id: reg.id,
            eventTitle: reg.event.title,
            status: reg.status,
            amount,
            customerEmail: reg.user.email,
            paymentIntentId,
        })
        await sendRegistrationIssueCustomerEmail(reg.user.email, reg.event.title)
        return
    }

    const { method: paymentMethod, receiptUrl } = await resolvePayment(paymentIntentId)

    const issuedBib = await withBib(reg.eventId, reg.bib, async (bib) => {
        await prisma.registration.update({
            where: { id: registrationId },
            data: {
                status: "PAID",
                paidAt: new Date(),
                note: null,
                bib,
                expiresAt: null,
                stripeSessionId: session.id,
                stripePaymentIntentId: paymentIntentId,
                paymentMethod,
                receiptUrl,
            },
        })
        return bib
    })

    await recalculateUserStats(reg.userId)
    await unlockAchievements(reg.userId)

    await sendRegistrationPaidEmail(
        reg.user.email,
        {
            id: reg.id,
            eventTitle: reg.event.title,
            eventDate: reg.event.date,
            categoryName: reg.category?.name ?? null,
            amount: registrationAmount(reg.category?.price ?? reg.event.price, reg.deliveryMethod),
            bib: issuedBib,
            deliveryMethod: reg.deliveryMethod,
        },
        receiptUrl
    )
}

/**
 * ยืนยันการชำระเงินของออเดอร์ร้านค้า → PAID
 *
 * เปลี่ยนสถานะด้วย updateMany ที่มี `status: "PENDING"` อยู่ในเงื่อนไข แล้วเช็ค count
 * เพื่อให้ idempotent — Stripe ส่งอีเวนต์ซ้ำได้ และ PromptPay ยิงมาสองรอบ
 * (completed + async_payment_succeeded) ถ้าปล่อยให้เขียนทับทุกครั้ง ออเดอร์ที่ถูก
 * ยกเลิก/หมดเวลาไปแล้ว (สต็อกคืนให้คนอื่นแล้ว) จะถูกดันกลับมาเป็น PAID
 */
async function markOrderPaid(orderId: string, session: Stripe.Checkout.Session) {
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null
    const { method: paymentMethod, receiptUrl } = await resolvePayment(paymentIntentId)

    const { count } = await prisma.order.updateMany({
        where: { id: orderId, status: "PENDING" },
        data: {
            status: "PAID",
            paidAt: new Date(),
            expiresAt: null,
            stripeSessionId: session.id,
            stripePaymentIntentId: paymentIntentId,
            paymentMethod,
            receiptUrl,
        },
    })

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true, user: { select: { email: true } } },
    })
    if (!order) return

    if (count === 1) {
        await sendOrderPaidEmail(order.user.email, toMailOrder(order), receiptUrl)
        return
    }

    // count = 0 แปลว่าออเดอร์ไม่ได้อยู่ในสถานะ PENDING แล้วตอนเงินเข้า
    //
    // ถ้าเป็น PAID อยู่แล้วแปลว่า Stripe ส่งอีเวนต์ซ้ำ (completed + async_payment_succeeded) — ไม่ต้องทำอะไร
    // แต่ถ้าเป็น EXPIRED/CANCELLED แปลว่าเงินเข้าจริงทั้งที่สต็อกถูกคืนให้คนอื่นไปแล้ว
    // ลูกค้าเสียเงินแต่ไม่ได้ของ ห้ามปล่อยเงียบเด็ดขาด — ต้องปักธงให้แอดมินตามเรื่อง
    if (order.status === "PAID" || order.paymentIssueAt) return

    await prisma.order.update({
        where: { id: orderId },
        data: {
            paymentIssueAt: new Date(),
            // เก็บร่องรอยการจ่ายไว้ใช้คืนเงิน/ตามรอยกับ Stripe
            stripeSessionId: session.id,
            stripePaymentIntentId: paymentIntentId,
            paymentMethod,
            receiptUrl,
            adminNote: `เงินเข้าแล้วแต่ออเดอร์อยู่ในสถานะ ${order.status} — ต้องคืนเงินหรือจัดส่งให้ลูกค้า`,
        },
    })

    await sendPaymentIssueAlert({
        id: order.id,
        orderNo: order.orderNo,
        status: order.status,
        total: order.total,
        customerEmail: order.user.email,
        paymentIntentId,
    })
    await sendPaymentIssueCustomerEmail(order.user.email, order.orderNo)
}

export async function POST(request: Request) {
    const signature = request.headers.get("stripe-signature")
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!signature || !webhookSecret) {
        return NextResponse.json({ error: "Webhook ยังไม่ได้ตั้งค่า" }, { status: 400 })
    }

    const body = await request.text()

    let event: Stripe.Event
    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (e) {
        const message = e instanceof Error ? e.message : "ลายเซ็นไม่ถูกต้อง"
        return NextResponse.json({ error: message }, { status: 400 })
    }

    // checkout.session.completed อย่างเดียวไม่พอ — วิธีจ่ายแบบ delayed-notification (เช่น PromptPay)
    // อาจส่ง completed มาตอน payment_status ยัง unpaid แล้วค่อยส่ง async_payment_succeeded ทีหลังตอนจ่ายจริงสำเร็จ
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.payment_status !== "unpaid") {
            // metadata.kind แยกสองสายที่ใช้ webhook เดียวกัน — ร้านค้า vs สมัครวิ่ง
            // session เก่าที่สร้างก่อนมีร้านค้าจะไม่มี kind จึงตกไปทางสมัครวิ่งเหมือนเดิม
            if (session.metadata?.kind === "order") {
                const orderId = session.metadata.orderId ?? session.client_reference_id
                if (orderId) await markOrderPaid(orderId, session)
            } else {
                const registrationId = session.metadata?.registrationId ?? session.client_reference_id
                if (registrationId) await markRegistrationPaid(registrationId, session)
            }
        }
    }

    // จ่ายแบบ delayed-notification แล้วไม่สำเร็จ (เช่น PromptPay QR หมดอายุ/ธนาคารปฏิเสธ) — ไม่ต้องทำอะไร
    // registration ยังเป็น PENDING อยู่แล้ว ผู้ใช้กลับไปลองจ่ายใหม่ได้จนกว่าจะหมดเวลา 24 ชม. ตามปกติ
    if (event.type === "checkout.session.async_payment_failed") {
        // no-op — เก็บไว้เป็นหลักฐานว่าเรารับรู้อีเวนต์นี้แล้ว ไม่ใช่ปล่อยผ่านโดยไม่ตั้งใจ
    }

    return NextResponse.json({ received: true })
}

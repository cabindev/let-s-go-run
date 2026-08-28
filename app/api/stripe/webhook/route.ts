import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { withBib } from "@/lib/vr"
import { recalculateUserStats } from "@/lib/stats"
import { unlockAchievements } from "@/lib/achievements"
import { PAYABLE_STATUS } from "@/lib/expiry"

export const dynamic = "force-dynamic"

/** เช็คว่า Checkout Session จ่ายด้วยบัตรหรือ PromptPay จาก payment method ที่ใช้จริง */
async function resolvePaymentMethod(paymentIntentId: string | null): Promise<string | null> {
    if (!paymentIntentId) return null
    try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["payment_method"] })
        const pm = pi.payment_method
        return typeof pm === "string" ? null : (pm?.type ?? null)
    } catch {
        return null
    }
}

/** ยืนยันการชำระเงินจาก Stripe → PAID (เทียบเท่า approveSlip ของแอดมิน) */
async function markRegistrationPaid(registrationId: string, session: Stripe.Checkout.Session) {
    const reg = await prisma.registration.findUnique({
        where: { id: registrationId },
        select: { userId: true, eventId: true, bib: true, status: true },
    })
    // ถ้าถูกยกเลิก/หมดเวลาไปแล้วระหว่างที่จ่ายเงินค้างอยู่ (เช่น ผู้ใช้กดยกเลิกเอง หรือระบบ sweep
    // ที่นั่งคืนให้คนอื่นไปแล้ว) ห้ามดันกลับเป็น PAID เพราะจะทำให้ที่นั่งถูกจองซ้อนเกินโควตา
    if (!reg || !PAYABLE_STATUS.includes(reg.status)) return

    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null
    const paymentMethod = await resolvePaymentMethod(paymentIntentId)

    await withBib(reg.eventId, reg.bib, (bib) =>
        prisma.registration.update({
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
            },
        })
    )

    await recalculateUserStats(reg.userId)
    await unlockAchievements(reg.userId)
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
        const registrationId = session.metadata?.registrationId ?? session.client_reference_id
        if (registrationId && session.payment_status !== "unpaid") {
            await markRegistrationPaid(registrationId, session)
        }
    }

    // จ่ายแบบ delayed-notification แล้วไม่สำเร็จ (เช่น PromptPay QR หมดอายุ/ธนาคารปฏิเสธ) — ไม่ต้องทำอะไร
    // registration ยังเป็น PENDING/WAITING อยู่แล้ว ผู้ใช้กลับไปลองจ่ายใหม่ได้จนกว่าจะหมดเวลา 24 ชม. ตามปกติ
    if (event.type === "checkout.session.async_payment_failed") {
        // no-op — เก็บไว้เป็นหลักฐานว่าเรารับรู้อีเวนต์นี้แล้ว ไม่ใช่ปล่อยผ่านโดยไม่ตั้งใจ
    }

    return NextResponse.json({ received: true })
}

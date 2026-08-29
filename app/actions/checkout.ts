'use server'

import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { requireUserAction } from "@/lib/auth-helpers"
import { isExpired, PAYABLE_STATUS } from "@/lib/expiry"
import { amountWithFee, FEE_LABEL, type PaymentMethodChoice } from "@/lib/checkout-fees"
import type { ActionResult } from "./registration"

/** ป้ายกำกับสุ่ม 8 ตัวอักษร — ใช้แยก session ในการดู/เทียบ checkout flow บน Stripe Dashboard */
function randomLabelSuffix() {
    const letters = "abcdefghijklmnopqrstuvwxyz"
    return Array.from({ length: 8 }, () => letters[Math.floor(Math.random() * letters.length)]).join("")
}

/**
 * สร้าง Stripe Checkout Session แล้วพาไปหน้าชำระเงินของ Stripe
 * @param method ผู้จ่ายเลือกวิธีจ่ายบนหน้าเราก่อนแล้ว (ไม่ใช่บนหน้า Stripe) เพราะยอดที่เรียกเก็บ
 *   บวกค่าธรรมเนียม Stripe ของแต่ละวิธีเข้าไปด้วย — ให้ผู้จัดงานได้รับเต็มค่าสมัคร ผู้จ่ายรับภาระค่าธรรมเนียมแทน
 */
export async function createCheckoutSession(registrationId: string, method: PaymentMethodChoice): Promise<ActionResult> {
    let checkoutUrl: string
    try {
        const user = await requireUserAction()

        const reg = await prisma.registration.findUnique({
            where: { id: registrationId },
            include: { event: true, category: true },
        })

        if (!reg || reg.userId !== user.id) return { ok: false, error: "ไม่พบรายการลงทะเบียน" }
        if (!PAYABLE_STATUS.includes(reg.status)) return { ok: false, error: "รายการนี้ชำระเงินไม่ได้แล้ว" }
        if (isExpired(reg)) return { ok: false, error: "หมดเวลาชำระเงินแล้ว กรุณาสมัครใหม่อีกครั้ง" }

        const amount = reg.category?.price ?? reg.event.price
        if (amount <= 0) return { ok: false, error: "รายการนี้ไม่มีค่าใช้จ่าย" }

        const total = amountWithFee(amount, method)
        const origin = process.env.NEXTAUTH_URL || "http://localhost:3000"
        const productName = reg.category ? `${reg.event.title} · ${reg.category.name}` : reg.event.title

        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            // ล็อกวิธีจ่ายตามที่เลือกไว้บนหน้าเรา (ยอดรวมค่าธรรมเนียมคำนวณมาสำหรับวิธีนี้โดยเฉพาะแล้ว)
            // ใช้ excluded_payment_method_types แทน payment_method_types ตามแนวทางของ Stripe เพราะ
            // ยังคงพึ่งการตั้งค่าเปิด-ปิดวิธีจ่ายจาก Dashboard อยู่ แค่ตัดวิธีอื่นออกสำหรับ session นี้
            excluded_payment_method_types: [method === "card" ? "promptpay" : "card"],
            integration_identifier: `activerun_registration_${randomLabelSuffix()}`,
            customer_email: user.email ?? undefined,
            client_reference_id: reg.id,
            metadata: { registrationId: reg.id, baseAmount: String(amount), paymentMethodChoice: method },
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
            success_url: `${origin}/payment/${reg.id}?checkout=success`,
            cancel_url: `${origin}/payment/${reg.id}?checkout=cancel`,
        })

        if (!session.url) return { ok: false, error: "สร้างรายการชำระเงินไม่สำเร็จ" }

        // เก็บ session id ไว้ตั้งแต่ตอนนี้ เผื่อใช้ตรวจสอบย้อนหลังแม้จะยังไม่จ่ายเสร็จ
        await prisma.registration.update({
            where: { id: reg.id },
            data: { stripeSessionId: session.id },
        })

        checkoutUrl = session.url
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "สร้างรายการชำระเงินไม่สำเร็จ" }
    }

    redirect(checkoutUrl)
}

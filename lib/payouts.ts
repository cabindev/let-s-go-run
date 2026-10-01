import type Stripe from "stripe"
import { stripe } from "@/lib/stripe"

/**
 * เงินที่ Stripe โอนเข้าบัญชีธนาคารจริง — ดึงสดจาก Stripe ทุกครั้ง ไม่เก็บลงฐานข้อมูล
 *
 * แยกจากรายงานรายได้ใน lib/revenue.ts โดยตั้งใจ: รายงานนั้นนับยอดที่ผู้สมัครจ่าย ส่วนตรงนี้คือยอดที่
 * ถึงบัญชีแล้วหลังหักค่าธรรมเนียม Stripe สองตัวเลขนี้จึงไม่เท่ากันเสมอ และไม่ควรเอามาบวกกัน
 */

export type PayoutRow = {
    id: string
    amount: number
    status: string
    arrivalDate: Date
    bankName: string | null
    last4: string | null
    failureMessage: string | null
}

export type PayoutSummary = {
    /** ยอดที่พร้อมโอนแต่ยังไม่ได้โอน */
    available: number
    /** ยอดที่ลูกค้าจ่ายแล้วแต่ Stripe ยังกันไว้ (ยังโอนไม่ได้) */
    incoming: number
    /** ยอดที่ถึงบัญชีแล้ว รวมทุกรายการที่แสดง */
    paidTotal: number
    payouts: PayoutRow[]
    /** true เมื่อใช้คีย์ทดสอบ — ตัวเลขไม่ใช่เงินจริง */
    testMode: boolean
}

const CURRENCY = "thb"

function sumThb(list: { amount: number; currency: string }[]) {
    // THB ใน Stripe เก็บเป็นสตางค์ (ทศนิยมสองตำแหน่ง)
    return list.filter((b) => b.currency === CURRENCY).reduce((s, b) => s + b.amount, 0) / 100
}

function bankOf(destination: Stripe.Payout["destination"]) {
    if (!destination || typeof destination === "string" || "deleted" in destination) return { bankName: null, last4: null }
    if (destination.object === "bank_account") return { bankName: destination.bank_name, last4: destination.last4 }
    return { bankName: null, last4: destination.last4 }
}

export async function getPayoutSummary(limit = 20): Promise<PayoutSummary> {
    const [balance, list] = await Promise.all([
        stripe.balance.retrieve(),
        stripe.payouts.list({ limit, expand: ["data.destination"] }),
    ])

    const payouts: PayoutRow[] = list.data
        .filter((p) => p.currency === CURRENCY)
        .map((p) => ({
            id: p.id,
            amount: p.amount / 100,
            status: p.status,
            arrivalDate: new Date(p.arrival_date * 1000),
            ...bankOf(p.destination),
            failureMessage: p.failure_message,
        }))

    return {
        available: sumThb(balance.available),
        incoming: sumThb(balance.pending),
        paidTotal: payouts.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0),
        payouts,
        testMode: !balance.livemode,
    }
}

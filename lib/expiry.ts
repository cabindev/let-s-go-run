import type { Prisma, RegistrationStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/** ต้องชำระเงินให้เสร็จภายในกี่ชั่วโมงหลังจอง */
export const PAYMENT_WINDOW_HOURS = 24

/** กำหนดเวลาชำระเงินนับจากตอนนี้ */
export function paymentDeadline(from: Date = new Date()) {
    return new Date(from.getTime() + PAYMENT_WINDOW_HOURS * 3600_000)
}

/** สถานะที่ยังต้องรอผู้สมัครจ่ายเงิน จึงมีเวลานับถอยหลัง */
const AWAITING_PAYMENT: RegistrationStatus[] = ["PENDING", "REJECTED"]

/** สถานะที่ยังชำระเงินได้ (รวม WAITING ที่ส่งสลิปรอตรวจอยู่ด้วย — จ่ายผ่านบัตร/PromptPay แทนได้) */
export const PAYABLE_STATUS: RegistrationStatus[] = ["PENDING", "REJECTED", "WAITING"]

export function isAwaitingPayment(status: RegistrationStatus) {
    return AWAITING_PAYMENT.includes(status)
}

/** หมดเวลาชำระเงินแล้วหรือยัง (ยังไม่ถูกกวาดเป็น EXPIRED ก็ตาม) */
export function isExpired(
    reg: { status: RegistrationStatus; expiresAt: Date | null },
    now: Date = new Date()
) {
    if (reg.status === "EXPIRED") return true
    if (!isAwaitingPayment(reg.status)) return false
    return !!reg.expiresAt && reg.expiresAt <= now
}

/** เวลาที่เหลือเป็นมิลลิวินาที (0 = หมดแล้ว, null = ไม่มีกำหนด) */
export function timeLeft(
    reg: { status: RegistrationStatus; expiresAt: Date | null },
    now: Date = new Date()
) {
    if (!isAwaitingPayment(reg.status) || !reg.expiresAt) return null
    return Math.max(0, reg.expiresAt.getTime() - now.getTime())
}

/**
 * เงื่อนไข "ที่นั่งนี้ยังถูกจองอยู่"
 *
 * คำนวณจาก expiresAt โดยตรง ไม่ได้รอให้ตัวกวาดทำงานก่อน
 * ที่นั่งจึงถูกปล่อยทันทีที่หมดเวลา แม้ยังไม่มีใครเรียก expireStaleRegistrations()
 */
export function heldSeatWhere(now: Date = new Date()): Prisma.RegistrationWhereInput {
    return {
        OR: [
            // จ่ายแล้ว หรือกำลังรอแอดมินตรวจสลิป — ไม่มีเวลาหมดอายุ
            { status: { in: ["WAITING", "PAID"] } },
            // ยังรอจ่าย และยังไม่หมดเวลา
            {
                status: { in: AWAITING_PAYMENT },
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
        ],
    }
}

/**
 * กวาดรายการที่หมดเวลาชำระเงินให้เป็น EXPIRED
 * เรียกได้บ่อยเท่าที่ต้องการ — ไม่มีผลข้างเคียงถ้าไม่มีอะไรหมดอายุ
 */
export async function expireStaleRegistrations(now: Date = new Date()) {
    const { count } = await prisma.registration.updateMany({
        where: {
            status: { in: AWAITING_PAYMENT },
            expiresAt: { not: null, lte: now },
        },
        data: { status: "EXPIRED", note: "ไม่ชำระเงินภายในเวลาที่กำหนด ระบบคืนที่นั่งอัตโนมัติ" },
    })
    return count
}

/** ข้อความเวลาที่เหลือ เช่น "12 ชม. 30 นาที" */
export function formatTimeLeft(ms: number) {
    if (ms <= 0) return "หมดเวลาแล้ว"
    const totalMinutes = Math.floor(ms / 60_000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (hours > 0) return `${hours} ชม. ${minutes} นาที`
    return `${minutes} นาที`
}

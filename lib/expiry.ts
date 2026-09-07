import type { Prisma, RegistrationStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/** ต้องชำระเงินให้เสร็จภายในกี่ชั่วโมงหลังจอง */
export const PAYMENT_WINDOW_HOURS = 24

/** กำหนดเวลาชำระเงินนับจากตอนนี้ */
export function paymentDeadline(from: Date = new Date()) {
    return new Date(from.getTime() + PAYMENT_WINDOW_HOURS * 3600_000)
}

/** สถานะที่ยังต้องรอผู้สมัครจ่ายเงิน จึงมีเวลานับถอยหลัง */
const AWAITING_PAYMENT: RegistrationStatus[] = ["PENDING"]

/** สถานะที่ยังชำระเงินได้ */
export const PAYABLE_STATUS: RegistrationStatus[] = ["PENDING"]

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
            // จ่ายแล้ว — ไม่มีเวลาหมดอายุ
            { status: "PAID" },
            // ยังรอจ่าย และยังไม่หมดเวลา
            {
                status: { in: AWAITING_PAYMENT },
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
        ],
    }
}

/**
 * เงื่อนไข "ที่นั่งนี้กินโควตาที่ประกาศรับสมัครไว้"
 *
 * ต่างจาก heldSeatWhere() ตรงที่ไม่นับคนที่เข้ามาด้วยโค้ดสิทธิพิเศษ — สปอนเซอร์และแขก
 * ผู้จัดงานถูกออกแบบให้อยู่ **นอก** จำนวนรับสมัคร (รับ 400 + โค้ด 40 = 440 คนจริง)
 * ถ้าเผลอใช้ heldSeatWhere() ตรงประตูรับสมัคร ที่นั่งของสปอนเซอร์จะไปกินโควตาคนทั่วไป
 * แล้วปิดรับสมัครเร็วกว่าที่ควร
 *
 * ใช้กับทุกจุดที่ตัดสินว่า "เต็มหรือยัง" และทุกจุดที่โชว์ที่นั่งคงเหลือให้ผู้สมัครเห็น
 * ส่วนหน้าแอดมินให้ใช้ heldSeatWhere() ต่อไป เพราะต้องเห็นยอดรวมจริงไว้สั่งเสื้อ/แจ้งประกัน
 */
export function publicSeatWhere(now: Date = new Date()): Prisma.RegistrationWhereInput {
    return { AND: [heldSeatWhere(now), { inviteCodeId: null }] }
}

/** ตรงข้ามกับ publicSeatWhere() — เฉพาะที่นั่งสิทธิพิเศษ ใช้แยกตัวเลขในหน้าแอดมิน */
export function inviteSeatWhere(now: Date = new Date()): Prisma.RegistrationWhereInput {
    return { AND: [heldSeatWhere(now), { inviteCodeId: { not: null } }] }
}

const EXPIRE_NOTE = "ไม่ชำระเงินภายในเวลาที่กำหนด ระบบคืนที่นั่งอัตโนมัติ"

/**
 * กวาดรายการที่หมดเวลาชำระเงินให้เป็น EXPIRED
 * เรียกได้บ่อยเท่าที่ต้องการ — ไม่มีผลข้างเคียงถ้าไม่มีอะไรหมดอายุ
 *
 * รายการที่ใช้โค้ดสิทธิพิเศษต้อง **คืนสิทธิ์ให้โค้ด** ด้วย ไม่งั้นสปอนเซอร์เสียสิทธิ์ฟรี ๆ
 * เพราะมีคนกดสมัครแล้วปล่อยทิ้ง จึงแยกออกมาทำทีละใบในทรานแซกชัน แล้วคืนสิทธิ์เฉพาะเมื่อ
 * เปลี่ยนสถานะสำเร็จจริง (count === 1) กันคืนซ้ำจนสิทธิ์งอกเกินที่ออกไว้ — กติกาเดียวกับ
 * การคืนสต็อกใน releaseOrder()
 *
 * ในทางปฏิบัติเคสนี้เกิดกับโค้ดลดบางส่วนเท่านั้น เพราะโค้ดฟรี 100% ยอดเป็น 0
 * จะได้สถานะ PAID ทันทีตั้งแต่แรก ไม่เคยเข้าสถานะรอชำระเงิน
 */
export async function expireStaleRegistrations(now: Date = new Date()) {
    const staleWhere: Prisma.RegistrationWhereInput = {
        status: { in: AWAITING_PAYMENT },
        expiresAt: { not: null, lte: now },
    }

    // ทางปกติ (ไม่มีโค้ด) — กวาดรวดเดียวเหมือนเดิม ไม่ต้องเสียรอบทรานแซกชันรายใบ
    const { count } = await prisma.registration.updateMany({
        where: { ...staleWhere, inviteCodeId: null },
        data: { status: "EXPIRED", note: EXPIRE_NOTE },
    })

    const withCode = await prisma.registration.findMany({
        where: { ...staleWhere, inviteCodeId: { not: null } },
        select: { id: true, inviteCodeId: true },
    })

    let released = 0
    for (const reg of withCode) {
        released += await prisma.$transaction(async (tx) => {
            const res = await tx.registration.updateMany({
                where: { id: reg.id, status: { in: AWAITING_PAYMENT } },
                data: { status: "EXPIRED", note: EXPIRE_NOTE },
            })
            if (res.count !== 1) return 0 // มีคนกวาดไปก่อนแล้ว ห้ามคืนสิทธิ์ซ้ำ
            await tx.inviteCode.updateMany({
                where: { id: reg.inviteCodeId!, usedCount: { gt: 0 } },
                data: { usedCount: { decrement: 1 } },
            })
            return 1
        })
    }

    return count + released
}

/**
 * คืนสิทธิ์ให้โค้ดเมื่อใบสมัครถูกยกเลิก
 *
 * ต้องเรียก **ภายในทรานแซกชันเดียวกับที่เปลี่ยนสถานะ** และเรียกเฉพาะเมื่อเปลี่ยนสำเร็จจริง
 * เท่านั้น (updateMany คืน count === 1) ไม่งั้นกดยกเลิกรัว ๆ จะได้สิทธิ์เพิ่มฟรี
 */
export async function releaseInviteSeat(
    tx: Prisma.TransactionClient,
    inviteCodeId: string | null
) {
    if (!inviteCodeId) return
    await tx.inviteCode.updateMany({
        where: { id: inviteCodeId, usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
    })
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

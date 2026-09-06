import type { OrderStatus, Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

type Tx = Prisma.TransactionClient

/**
 * คืนสต็อกของทุกชิ้นในออเดอร์
 *
 * ต้องเรียกภายในทรานแซกชันที่ "เปลี่ยนสถานะออเดอร์สำเร็จแล้วเท่านั้น" ห้ามเรียกลอยๆ
 * ไม่งั้นถ้าถูกเรียกซ้ำ (cron ยิงซ้ำ, ผู้ใช้กดรัว, webhook ส่งซ้ำ) สต็อกจะงอกเกินจริง
 *
 * variant ที่ stock เป็น null คือไม่จำกัดจำนวน จึงไม่มีอะไรต้องคืน — เงื่อนไข
 * `stock: { not: null }` กันไว้ไม่ให้ null กลายเป็นตัวเลขขึ้นมาเอง
 */
async function restoreStock(tx: Tx, orderId: string) {
    const items = await tx.orderItem.findMany({
        where: { orderId },
        select: { variantId: true, quantity: true },
    })

    for (const item of items) {
        if (!item.variantId) continue // สินค้าถูกลบไปแล้ว ไม่มีสต็อกให้คืน
        await tx.productVariant.updateMany({
            where: { id: item.variantId, stock: { not: null } },
            data: { stock: { increment: item.quantity } },
        })
    }
}

/**
 * เปลี่ยนสถานะออเดอร์พร้อมคืนสต็อก — idempotent
 *
 * ใช้ `updateMany` ที่มีสถานะเดิมอยู่ในเงื่อนไข แล้วเช็ค `count === 1` เป็นตัวตัดสินว่า
 * "เราเป็นคนเปลี่ยนสถานะจริง" ถ้ามีใครเปลี่ยนไปก่อนแล้ว count จะเป็น 0 และไม่คืนสต็อกซ้ำ
 * (รูปแบบเดียวกับที่ markRegistrationPaid ใช้กัน webhook ซ้ำ)
 *
 * @returns true ถ้าเปลี่ยนสถานะ+คืนสต็อกในรอบนี้จริง, false ถ้าถูกเปลี่ยนไปก่อนแล้ว
 */
export async function releaseOrder(
    orderId: string,
    toStatus: Extract<OrderStatus, "EXPIRED" | "CANCELLED" | "REFUNDED">,
    fromStatus: OrderStatus[],
    note?: string
) {
    return prisma.$transaction(async (tx) => {
        const { count } = await tx.order.updateMany({
            where: { id: orderId, status: { in: fromStatus } },
            data: {
                status: toStatus,
                expiresAt: null,
                ...(note ? { adminNote: note } : {}),
            },
        })
        if (count !== 1) return false

        await restoreStock(tx, orderId)
        return true
    })
}

/**
 * กวาดออเดอร์ที่ไม่ชำระเงินตามกำหนด แล้วคืนสต็อกให้คนอื่นซื้อต่อได้
 * เรียกซ้ำได้ไม่จำกัด — ออเดอร์ที่ถูกกวาดไปแล้วจะไม่ถูกคืนสต็อกอีก
 */
export async function expireStaleOrders(now: Date = new Date()) {
    const stale = await prisma.order.findMany({
        where: { status: "PENDING", expiresAt: { not: null, lte: now } },
        select: { id: true },
    })

    let expired = 0
    for (const { id } of stale) {
        const done = await releaseOrder(
            id,
            "EXPIRED",
            ["PENDING"],
            "ไม่ชำระเงินภายในเวลาที่กำหนด ระบบคืนสต็อกอัตโนมัติ"
        )
        if (done) expired++
    }
    return expired
}

/** หมดเวลาชำระแล้วหรือยัง (แม้ตัวกวาดยังไม่ทำงาน) */
export function isOrderExpired(
    order: { status: OrderStatus; expiresAt: Date | null },
    now: Date = new Date()
) {
    if (order.status === "EXPIRED") return true
    if (order.status !== "PENDING") return false
    return !!order.expiresAt && order.expiresAt <= now
}

/** เวลาที่เหลือเป็นมิลลิวินาที (0 = หมดแล้ว, null = ไม่มีกำหนด) */
export function orderTimeLeft(
    order: { status: OrderStatus; expiresAt: Date | null },
    now: Date = new Date()
) {
    if (order.status !== "PENDING" || !order.expiresAt) return null
    return Math.max(0, order.expiresAt.getTime() - now.getTime())
}

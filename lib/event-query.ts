import type { Prisma } from "@prisma/client"
import { DISTANCE_BANDS } from "@/lib/events"
import { heldSeatWhere } from "@/lib/expiry"

export interface EventFilters {
    q?: string
    province?: string
    distance?: string
    filter?: string
    /** ONSITE = วิ่งในงาน, VIRTUAL = วิ่งสะสมระยะ */
    type?: string
}

/**
 * แปลงพารามิเตอร์ค้นหาเป็นเงื่อนไข Prisma
 * ระยะทางต้องตรวจทั้งค่าของงานเอง และของประเภทการแข่งขัน
 */
export function buildEventWhere({ q, province, distance, filter, type }: EventFilters): Prisma.EventWhereInput {
    const now = new Date()
    const and: Prisma.EventWhereInput[] = []

    if (q?.trim()) {
        const term = q.trim()
        and.push({
            OR: [
                { title: { contains: term } },
                { location: { contains: term } },
                { organizer: { contains: term } },
                { description: { contains: term } },
            ],
        })
    }

    if (province) and.push({ province })

    if (type === "ONSITE" || type === "VIRTUAL") and.push({ type })

    if (distance) {
        const band = DISTANCE_BANDS.find((b) => b.key === distance)
        if (band) {
            const range = { gte: band.min, lte: band.max }
            and.push({
                OR: [
                    { categories: { some: { distance: range } } },
                    { AND: [{ categories: { none: {} } }, { distance: range }] },
                ],
            })
        }
    }

    switch (filter) {
        case "open":
            and.push({ status: "OPEN", date: { gte: now } })
            break
        case "free":
            and.push({
                date: { gte: now },
                OR: [
                    { categories: { some: { price: 0 } } },
                    { AND: [{ categories: { none: {} } }, { price: 0 }] },
                ],
            })
            break
        case "past":
            // งานสะสมระยะจะจบเมื่อเลยวันสิ้นสุด ไม่ใช่วันเริ่ม
            and.push({
                OR: [
                    { endDate: { not: null, lt: now } },
                    { AND: [{ endDate: null }, { date: { lt: now } }] },
                ],
            })
            break
        case "all":
            break
        default: // upcoming — งานที่ยังไม่จบ (รวมงานสะสมระยะที่กำลังดำเนินอยู่)
            and.push({
                OR: [
                    { endDate: { not: null, gte: now } },
                    { AND: [{ endDate: null }, { date: { gte: now } }] },
                ],
            })
    }

    return and.length > 0 ? { AND: and } : {}
}

export const EVENT_INCLUDE = {
    categories: { orderBy: [{ sortOrder: "asc" }, { price: "asc" }] },
    _count: { select: { registrations: { where: heldSeatWhere() } } },
} satisfies Prisma.EventInclude

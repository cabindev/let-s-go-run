import { prisma } from "@/lib/prisma"
import type { Event, RaceCategory } from "@prisma/client"

/**
 * ─── ความต่างระหว่างงานสองประเภท ───
 * ONSITE  : วิ่งในงาน — ไม่ต้องส่งผล ระบบนับระยะให้เมื่อกิจกรรมจบและยืนยันการชำระเงินแล้ว
 * VIRTUAL : วิ่งสะสมระยะ — ต้องส่งผลเอง ระยะสะสมมาจากผลที่ส่งเท่านั้น
 */

/**
 * ออกเลข BIB ถัดไปของงาน — เพิ่มค่า `Event.bibCounter` แบบ atomic (single UPDATE ... SET x = x + 1)
 * รับประกันไม่ซ้ำแม้มีคนยืนยันการชำระเงินพร้อมกันจำนวนมาก โดยไม่ต้อง retry
 * (เดิมอ่านเลขล่าสุดจาก MAX(bib) แล้ว +1 ซึ่งไม่ atomic — พลาดได้ถ้าแข่งกันเยอะ เปลี่ยนมาใช้ตัวนับแทน)
 */
export async function issueBib(eventId: string): Promise<string> {
    const event = await prisma.event.update({
        where: { id: eventId },
        data: { bibCounter: { increment: 1 } },
        select: { bibCounter: true },
    })
    return String(event.bibCounter).padStart(4, "0")
}

/** ออกเลข BIB แล้วบันทึกผ่าน `update` — ใช้เลขเดิมถ้ามีอยู่แล้ว ไม่งั้นออกใหม่ */
export async function withBib<T>(
    eventId: string,
    existingBib: string | null,
    update: (bib: string) => Promise<T>
): Promise<T> {
    const bib = existingBib ?? (await issueBib(eventId))
    return update(bib)
}

/** ระยะเป้าหมายของผู้สมัคร (ประเภทที่เลือก หรือค่าของงาน) */
export function targetOf(reg: { category: { distance: number } | null; event: { distance: number } }) {
    return reg.category?.distance ?? reg.event.distance
}

/** ช่วงเวลาที่ส่งผลได้ = ช่วงจัดงาน */
export function submissionWindow(event: Pick<Event, "date" | "endDate">) {
    return { start: event.date, end: event.endDate ?? event.date }
}

export type SubmitState = { open: true } | { open: false; reason: string }

export function submitState(event: Pick<Event, "date" | "endDate" | "status">, now = new Date()): SubmitState {
    if (event.status === "CANCELLED") return { open: false, reason: "กิจกรรมนี้ถูกยกเลิก" }
    const { start, end } = submissionWindow(event)
    if (now < start) return { open: false, reason: `ยังไม่ถึงวันเริ่มสะสมระยะ` }
    if (now > end) return { open: false, reason: "หมดเวลาส่งผลแล้ว" }
    return { open: true }
}

/** ความคืบหน้าของผู้สมัครหนึ่งคน */
export async function getProgress(registrationId: string) {
    const reg = await prisma.registration.findUnique({
        where: { id: registrationId },
        include: {
            event: { select: { distance: true } },
            category: { select: { distance: true } },
            submissions: { orderBy: { runDate: "desc" } },
        },
    })
    if (!reg) return null

    const target = targetOf(reg)
    const total = reg.submissions.reduce((s, x) => s + x.distance, 0)

    return {
        target,
        total,
        percent: target > 0 ? Math.min(100, (total / target) * 100) : 0,
        finished: target > 0 && total >= target,
        submissions: reg.submissions,
        lastSubmission: reg.submissions[0] ?? null,
    }
}

export interface WallRow {
    registrationId: string
    rank: number
    name: string
    bib: string | null
    image: string | null
    categoryName: string | null
    target: number
    total: number
    percent: number
    finished: boolean
    lastDistance: number | null
    lastRunDate: Date | null
}

/**
 * Finisher Wall — จัดอันดับผู้สมัครของงานตามระยะสะสม
 * @param categoryId กรองเฉพาะประเภทเดียว (null = ทุกประเภท)
 */
export async function getFinisherWall(
    event: Event & { categories: RaceCategory[] },
    categoryId?: string | null
): Promise<{ rows: WallRow[]; runners: number; totalDistance: number }> {
    const regs = await prisma.registration.findMany({
        where: {
            eventId: event.id,
            status: "PAID",
            ...(categoryId ? { categoryId } : {}),
        },
        include: {
            user: { select: { name: true, image: true } },
            category: { select: { name: true, distance: true } },
            submissions: { orderBy: { runDate: "desc" } },
        },
    })

    const rows = regs
        .map((r) => {
            const target = r.category?.distance ?? event.distance
            const total = r.submissions.reduce((s, x) => s + x.distance, 0)
            const last = r.submissions[0] ?? null
            return {
                registrationId: r.id,
                rank: 0,
                name: r.fullName || r.user.name || "นักวิ่ง",
                bib: r.bib,
                image: r.user.image,
                categoryName: r.category?.name ?? null,
                target,
                total,
                percent: target > 0 ? Math.min(100, (total / target) * 100) : 0,
                finished: target > 0 && total >= target,
                lastDistance: last?.distance ?? null,
                lastRunDate: last?.runDate ?? null,
            }
        })
        .sort((a, b) => b.percent - a.percent || b.total - a.total)
        .map((r, i) => ({ ...r, rank: i + 1 }))

    return {
        rows,
        runners: rows.length,
        totalDistance: rows.reduce((s, r) => s + r.total, 0),
    }
}

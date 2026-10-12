import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * งานที่ยังเช็ครายชื่อได้ — งานหน้างานที่ยังไม่จบ บวกหนึ่งวันให้ยังค้นได้ตลอดวันงาน
 * ใช้ร่วมกันระหว่างหน้าแรก (ซ่อน/โชว์กล่อง) กับ lookupRunner กันสองที่ตัดสินไม่ตรงกัน
 */
export function lookupEventWhere(): Prisma.EventWhereInput {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return {
        type: "ONSITE",
        OR: [{ endDate: { gte: dayAgo } }, { endDate: null, date: { gte: dayAgo } }],
    }
}

/** มีใบสมัครที่จ่ายแล้วของงานที่ยังเช็คได้อย่างน้อยหนึ่งใบไหม — ไม่มีก็ไม่ต้องโชว์กล่องบนหน้าแรก */
export async function hasRunnerLookup() {
    const reg = await prisma.registration.findFirst({
        where: { status: "PAID", event: lookupEventWhere() },
        select: { id: true },
    })
    return !!reg
}

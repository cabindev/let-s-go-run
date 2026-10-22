import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { formatBib } from "@/lib/bib-format"

export { formatBib, validateBibRange } from "@/lib/bib-format"

/**
 * ─── หลักการออกเลข BIB (ตามแนวปฏิบัติงานวิ่งสากล) ───
 *
 * 1. ไม่ซ้ำกันทั้งงาน — หนึ่งเลข = หนึ่งคน ใช้อ้างอิงต่อในผลวิ่ง ชิปจับเวลา หน่วยพยาบาล และรูปถ่าย
 *    (DB: unique (eventId, bibScope, bib) โดยใบที่ระบบออกมี bibScope = "" เสมอ)
 * 2. ออกเมื่อยืนยันการชำระเงินแล้วเท่านั้น เรียงตามลำดับ ด้วยตัวนับแบบ atomic
 * 3. แยกระยะด้วย "ช่วงเลข" หรือ "ตัวอักษรนำ" ของระยะนั้น (RaceCategory.bibPrefix/bibStart/bibEnd)
 *    ไม่ใส่ความหมายอื่น เช่นเพศ ลงในเลข
 * 4. ออกแล้วห้ามเปลี่ยน และไม่นำเลขของใบที่ยกเลิกกลับมาใช้ใหม่ — DB มี trigger กันแก้ + บันทึก BibChangeLog
 *
 * ระยะที่ไม่ได้ตั้งช่วงเลข ใช้ตัวนับรวมของงาน (Event.bibCounter) → 0001, 0002, ...
 */

type Tx = Prisma.TransactionClient

/** เลขถัดไปจากตัวนับ (ไม่สนว่าเลขถูกใช้ไปแล้วหรือยัง — ผู้เรียกเช็คต่อ) */
async function nextCandidate(tx: Tx, eventId: string, categoryId: string | null): Promise<string> {
    const cat = categoryId
        ? await tx.raceCategory.findUnique({
              where: { id: categoryId },
              select: { name: true, bibPrefix: true, bibStart: true, bibEnd: true },
          })
        : null

    if (cat?.bibStart != null) {
        // ตัวนับของระยะเริ่มที่ bibStart - 1 (ตั้งไว้ตอนบันทึกช่วงเลข) — increment เป็น UPDATE เดียว ล็อกแถวไว้จนจบทรานแซกชัน
        const { bibCounter } = await tx.raceCategory.update({
            where: { id: categoryId! },
            data: { bibCounter: { increment: 1 } },
            select: { bibCounter: true },
        })
        // เกินเลขสุดท้ายได้เฉพาะกรณีผู้ถือโค้ดสิทธิพิเศษ (ข้ามโควตา) หรือไม่ได้ตั้งจำนวนที่รับ —
        // ไม่ปฏิเสธ เพราะคนนี้จ่ายเงิน/ยืนยันแล้ว ต้องได้เลข ออกเลขต่อไปเรื่อยๆ (ยังไม่ซ้ำ เพราะ issueBibTx ข้ามเลขที่มีคนใช้)
        if (cat.bibEnd != null && bibCounter > cat.bibEnd) {
            console.warn(`[bib] ระยะ "${cat.name}" ออกเลขเกินช่วงที่ตั้งไว้ (${formatBib(cat.bibPrefix, bibCounter)})`)
        }
        return formatBib(cat.bibPrefix, bibCounter)
    }

    const { bibCounter } = await tx.event.update({
        where: { id: eventId },
        data: { bibCounter: { increment: 1 } },
        select: { bibCounter: true },
    })
    return formatBib(null, bibCounter)
}

/**
 * ออกเลข BIB ใหม่ภายในทรานแซกชันที่ผู้เรียกเปิดไว้
 * ข้ามเลขที่มีคนใช้อยู่แล้วในงาน (เช่นช่วงเลขของระยะไปชนกับตัวนับรวม หรือข้อมูลที่นำเข้ามือ)
 * — unique index เป็นด่านสุดท้ายอีกชั้น
 */
export async function issueBibTx(tx: Tx, eventId: string, categoryId: string | null): Promise<string> {
    for (let i = 0; i < 1000; i++) {
        const bib = await nextCandidate(tx, eventId, categoryId)
        const taken = await tx.registration.findFirst({ where: { eventId, bibScope: "", bib }, select: { id: true } })
        if (!taken) return bib
    }
    throw new Error("หาเลข BIB ว่างไม่ได้ — ตรวจช่วงเลข BIB ของงานนี้")
}

/**
 * ออกเลข BIB ให้ใบสมัคร (ถ้ายังไม่มี) แล้วบันทึกผ่าน `update` ในทรานแซกชันเดียวกัน
 * มีเลขอยู่แล้ว → ใช้เลขเดิมเสมอ (เลขผูกกับคน ห้ามเปลี่ยน)
 *
 * อ่านเลขปัจจุบันใหม่ในทรานแซกชันแบบล็อกแถว (FOR UPDATE) — webhook ที่ Stripe ส่งซ้ำพร้อมกัน
 * จะต่อคิวกัน ใบที่สองเห็นเลขที่ใบแรกออกไปแล้ว ไม่ออกเลขใหม่ทับ
 */
export async function withBib<T>(
    registrationId: string,
    update: (tx: Tx, bib: string) => Promise<T>
): Promise<T> {
    return prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ eventId: string; categoryId: string | null; bib: string | null }[]>`
            SELECT eventId, categoryId, bib FROM Registration WHERE id = ${registrationId} FOR UPDATE`
        const reg = rows[0]
        if (!reg) throw new Error("ไม่พบใบสมัคร")
        const bib = reg.bib ?? (await issueBibTx(tx, reg.eventId, reg.categoryId))
        return update(tx, bib)
    })
}

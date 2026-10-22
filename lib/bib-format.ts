/**
 * ส่วนของเลข BIB ที่ไม่แตะฐานข้อมูล — ใช้ได้ทั้งฝั่ง server และ client component
 * หลักการออกเลขทั้งหมดดูที่ lib/bib.ts
 */

export function formatBib(prefix: string | null | undefined, n: number): string {
    return `${prefix ?? ""}${String(n).padStart(4, "0")}`
}

// ───────────── ตั้งช่วงเลขของระยะ (หน้าแอดมิน) ─────────────

export type BibRangeInput = { prefix: string; start: number | null; end: number | null }

/**
 * ตรวจช่วงเลขก่อนบันทึก — คืนข้อความ error หรือ null
 * others = ระยะอื่นในงานเดียวกัน
 */
export function validateBibRange(
    input: BibRangeInput,
    maxSlots: number | null,
    others: { name: string; bibPrefix: string | null; bibStart: number | null; bibEnd: number | null }[]
): string | null {
    if (!/^[A-Z]{0,3}$/.test(input.prefix)) return "ตัวอักษรนำหน้าใช้ได้เฉพาะ A–Z ไม่เกิน 3 ตัว"
    if (input.start == null) return input.end == null && !input.prefix ? null : "กรอกเลขเริ่มต้น"
    if (!Number.isInteger(input.start) || input.start < 1) return "เลขเริ่มต้นต้องเป็นจำนวนเต็มตั้งแต่ 1"
    if (input.end != null) {
        if (!Number.isInteger(input.end) || input.end < input.start) return "เลขสุดท้ายต้องไม่น้อยกว่าเลขเริ่มต้น"
        if (maxSlots != null && input.end - input.start + 1 < maxSlots) {
            return `ช่วงเลขมี ${input.end - input.start + 1} เลข น้อยกว่าจำนวนที่รับ (${maxSlots})`
        }
    }
    // ตัวอักษรนำต่างกัน = เลขไม่มีทางชน (ตัวอักษรนำเป็นตัวอักษรล้วน) → เช็คทับซ้อนเฉพาะตัวอักษรนำเดียวกัน
    const end = input.end ?? Number.MAX_SAFE_INTEGER
    for (const o of others) {
        if (o.bibStart == null || (o.bibPrefix ?? "") !== input.prefix) continue
        const oEnd = o.bibEnd ?? Number.MAX_SAFE_INTEGER
        if (input.start <= oEnd && o.bibStart <= end) {
            return `ช่วงเลขทับกับระยะ "${o.name}" (${formatBib(o.bibPrefix, o.bibStart)}–${o.bibEnd != null ? formatBib(o.bibPrefix, o.bibEnd) : "ไม่จำกัด"})`
        }
    }
    return null
}

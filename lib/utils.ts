import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
const TH_MONTHS_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]
const TH_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"]

/** 12 ต.ค. 2569 */
export function formatDate(date: Date | string) {
    const d = new Date(date)
    return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}

/** วันเสาร์ที่ 12 ตุลาคม 2569 */
export function formatDateLong(date: Date | string) {
    const d = new Date(date)
    return `วัน${TH_DAYS[d.getDay()]}ที่ ${d.getDate()} ${TH_MONTHS_FULL[d.getMonth()]} ${d.getFullYear() + 543}`
}

/** 06:00 น. */
export function formatTime(date: Date | string) {
    const d = new Date(date)
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} น.`
}

/** 06:00 - 09:00 น. หรือ 06:00 น. ถ้าไม่มีเวลาสิ้นสุด */
export function formatTimeRange(start: Date | string, end?: Date | string | null) {
    const s = new Date(start)
    const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    if (!end) return `${hhmm(s)} น.`
    return `${hhmm(s)} - ${hhmm(new Date(end))} น.`
}

/** ช่วงวันที่: "25 ส.ค. 2569 - 20 ธ.ค. 2569" หรือวันเดียวถ้าจบวันเดียวกัน */
export function formatDateRange(start: Date | string, end?: Date | string | null) {
    const s = new Date(start)
    if (!end) return formatDate(s)
    const e = new Date(end)
    if (s.toDateString() === e.toDateString()) return formatDate(s)
    return `${formatDate(s)} - ${formatDate(e)}`
}

/** ฿1,200 หรือ "ฟรี" */
export function formatPrice(price: number) {
    if (price <= 0) return "ฟรี"
    return `฿${price.toLocaleString("th-TH", { maximumFractionDigits: 2 })}`
}

/** ฿0 / ฿1,200 — ใช้กับยอดเงินที่ 0 ต้องอ่านว่าศูนย์บาท ไม่ใช่ "ฟรี" */
export function formatBaht(amount: number) {
    return `฿${amount.toLocaleString("th-TH", { maximumFractionDigits: 2 })}`
}

export function formatNumber(n: number, digits = 0) {
    return n.toLocaleString("th-TH", { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** "อีก 3 วัน" / "วันนี้" / "ผ่านไปแล้ว 2 วัน" */
export function relativeDay(date: Date | string) {
    const d = new Date(date)
    const today = new Date()
    d.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
    if (diff === 0) return "วันนี้"
    if (diff === 1) return "พรุ่งนี้"
    if (diff > 1) return `อีก ${diff} วัน`
    if (diff === -1) return "เมื่อวาน"
    return `ผ่านมาแล้ว ${Math.abs(diff)} วัน`
}

/** ค่าเริ่มต้นของ <input type="date"> */
export function formatDateInput(date: Date | string) {
    const d = new Date(date)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatDateTimeInput(date: Date | string) {
    const d = new Date(date)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function initials(name?: string | null, email?: string | null) {
    const source = name?.trim() || email || "?"
    return source.charAt(0).toUpperCase()
}

/** เลขบัตรประชาชนแบบปิดบางส่วน — โชว์แค่หลักแรกกับหลักสุดท้าย เช่น "1-XXXXXXXXXXX-8" */
export function maskNationalId(id: string) {
    if (id.length < 2) return id
    return `${id[0]}-${"X".repeat(id.length - 2)}-${id[id.length - 1]}`
}

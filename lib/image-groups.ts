import type { ImageCategory } from "@prisma/client"

/**
 * หมวดรูปประกอบของงาน — แก้ที่ไฟล์นี้ที่เดียว มีผลทั้งฟอร์มอัปโหลดและหน้าแสดงผล
 *
 * `suggested` เป็นแค่ "จำนวนที่แนะนำ" เพื่อบอกใบ้แอดมิน ไม่ใช่ขีดจำกัด
 * ทุกหมวดไม่บังคับ จะไม่แนบเลยก็ได้ และแนบเกินจำนวนที่แนะนำก็ได้
 */
export interface ImageGroup {
    key: ImageCategory
    label: string
    hint: string
    suggested: number
}

export const IMAGE_GROUPS: ImageGroup[] = [
    { key: "SHIRT", label: "เสื้อ", hint: "แนะนำด้านหน้าและด้านหลัง", suggested: 2 },
    { key: "MEDAL", label: "เหรียญ", hint: "แนะนำด้านหน้าและด้านหลัง", suggested: 2 },
    { key: "ROUTE", label: "แผนที่เส้นทาง", hint: "เส้นทางวิ่ง หรือกราฟความชัน", suggested: 1 },
    { key: "SIZE_GUIDE", label: "ตารางไซส์", hint: "ตารางขนาดเสื้อ", suggested: 1 },
    { key: "ATMOSPHERE", label: "บรรยากาศงาน", hint: "ภาพจากงานปีก่อน หรือภาพโปรโมต", suggested: 3 },
    { key: "OTHER", label: "อื่น ๆ", hint: "รูปประกอบอื่นที่ไม่เข้าหมวดข้างบน", suggested: 0 },
]

export const GROUP_LABEL: Record<ImageCategory, string> = Object.fromEntries(
    IMAGE_GROUPS.map((g) => [g.key, g.label])
) as Record<ImageCategory, string>

/** ชื่อ input ของแต่ละหมวด เช่น gallery:SHIRT */
export const groupField = (key: ImageCategory) => `gallery:${key}`


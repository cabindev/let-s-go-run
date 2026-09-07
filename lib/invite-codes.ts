import type { InviteCode } from "@prisma/client"

/**
 * ตัวอักษรที่ใช้สร้างโค้ด — ตัด 0/O และ 1/I/L ออก
 * เพราะโค้ดพวกนี้ถูกอ่านให้กันฟังทางโทรศัพท์และพิมพ์ต่อในไลน์ ตัวที่หน้าตาใกล้กันคือต้นเหตุ
 * ของ "ใส่แล้วบอกว่าไม่พบรหัส" ที่ไม่ใช่ความผิดใคร (ชุดเดียวกับที่เลขที่คำสั่งซื้อใช้)
 */
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

/** ความยาวโค้ด — 32^8 ≈ 1.1 ล้านล้านแบบ เดาสุ่มไม่คุ้มแม้ไม่มี rate limit */
const CODE_LENGTH = 8

/**
 * สุ่มโค้ดสิทธิพิเศษ
 *
 * ใช้ crypto.getRandomValues ไม่ใช่ Math.random — โค้ดนี้มีมูลค่าเท่าค่าสมัคร
 * ค่าที่เดาลำดับถัดไปได้จึงถือเป็นช่องโหว่ (Web Crypto มีทั้งใน Node 18+ และเบราว์เซอร์
 * จึงไม่ต้อง import node:crypto ที่จะทำให้ไฟล์นี้ใช้ฝั่ง client ไม่ได้)
 *
 * ตัดเศษด้วยการวนสุ่มใหม่แทน modulo เพื่อให้ทุกตัวอักษรมีโอกาสเท่ากันจริง
 */
export function generateInviteCode(length = CODE_LENGTH) {
    const max = 256 - (256 % CODE_ALPHABET.length)
    const out: string[] = []
    while (out.length < length) {
        const bytes = new Uint8Array(length)
        crypto.getRandomValues(bytes)
        for (const b of bytes) {
            if (b >= max) continue // ค่าที่ทำให้การแจกแจงเอียง ทิ้งแล้วสุ่มใหม่
            out.push(CODE_ALPHABET[b % CODE_ALPHABET.length])
            if (out.length === length) break
        }
    }
    return out.join("")
}

/** ผู้ใช้พิมพ์มาแบบไหนก็ได้ — ตัดช่องว่าง ขีด และแปลงเป็นตัวใหญ่ก่อนค้นหา */
export function normalizeInviteCode(input: string) {
    return input.trim().toUpperCase().replace(/[\s-]/g, "")
}

/**
 * ราคาหลังหักส่วนลด
 *
 * เก็บเป็นเปอร์เซ็นต์อย่างเดียว จึงได้สัดส่วนเท่ากันทุกรุ่นโดยอัตโนมัติ
 * ไม่ต้องอธิบายว่าทำไมคนวิ่งไกลกว่าได้ลดน้อยกว่า และไม่มีทางติดลบ
 */
export function discountedPrice(price: number, discountPercent: number) {
    const pct = Math.min(100, Math.max(0, discountPercent))
    return Math.max(0, Math.round((price * (100 - pct)) / 100))
}

export type InviteCodeState =
    | { ok: true }
    | { ok: false; reason: string }

/**
 * ตรวจว่าโค้ดใบนี้ยังใช้ได้ไหม
 *
 * ข้อความที่คืนไปตั้งใจให้บอกสาเหตุจริง (ใช้ครบแล้ว / หมดอายุ) เพราะคนถือโค้ดคือแขก
 * ที่เราเชิญมาเอง ถ้าบอกแค่ "ใช้ไม่ได้" เขาจะโทรหาผู้จัดงานทุกราย
 * แต่ห้ามบอกจำนวนสิทธิ์คงเหลือ นั่นเป็นข้อมูลของสปอนเซอร์
 */
export function inviteCodeState(code: InviteCode, now: Date = new Date()): InviteCodeState {
    if (!code.active) return { ok: false, reason: "รหัสนี้ถูกปิดการใช้งานแล้ว" }
    if (code.expiresAt && code.expiresAt <= now) return { ok: false, reason: "รหัสนี้หมดอายุแล้ว" }
    if (code.usedCount >= code.maxUses) return { ok: false, reason: "รหัสนี้ถูกใช้ครบจำนวนแล้ว" }
    return { ok: true }
}

/** ป้ายบอกส่วนลดสำหรับแสดงผล */
export function discountLabel(discountPercent: number) {
    return discountPercent >= 100 ? "ฟรี ไม่มีค่าสมัคร" : `ลด ${discountPercent}%`
}

/** โค้ดที่ทำให้ยอดเป็นศูนย์ = ต้องรับของที่งานเท่านั้น (ไม่มีค่าส่งให้เก็บ) */
export function isFullyDiscounted(discountPercent: number) {
    return discountPercent >= 100
}

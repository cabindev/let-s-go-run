'use server'

import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { nationalIdKey, phoneKey } from "@/lib/phone"
import { formatDate } from "@/lib/utils"
import { lookupEventWhere } from "@/lib/runner-lookup"

/*
 * เช็ครายชื่อนักวิ่งจากหน้าแรก — หน้าสาธารณะ ไม่ต้องล็อกอิน
 *
 * ใครก็พิมพ์ได้ เลยตั้งใจให้รั่วน้อยที่สุด:
 * - ต้องพิมพ์เบอร์ครบ 10 หลัก หรือเลขบัตรครบ 13 หลัก ไม่ค้นบางส่วน
 * - ชื่อปิดบางส่วน ไม่ส่งเลขบัตร เบอร์ วันเกิด หรือข้อมูลสุขภาพกลับไปเลย
 * - ไม่ส่ง QR / registrationId — QR คือกุญแจรับของที่บูธ (ดู lookupRegistrationForCheckin)
 *   ถ้าโชว์ตรงนี้ ใครรู้เบอร์เพื่อนก็ไปรับของแทนได้
 * - เฉพาะงานที่ยังไม่จบ หลังวันงานค้นไม่เจออีก
 * - จำกัดจำนวนครั้งต่อ IP กันไล่เบอร์ดึงรายชื่อทั้งงาน
 * - ไม่เจอก็ตอบข้อความเดียวกันเสมอ ไม่บอกว่าเบอร์นี้ "มี" หรือ "ไม่มี" ในระบบ
 */

export interface RunnerLookupResult {
    eventTitle: string
    eventDate: string
    categoryName: string | null
    maskedName: string
    bib: string | null
    shirtSize: string | null
    pickupStatus: "PENDING" | "PICKED_UP" | "SHIPPED"
}

const NOT_FOUND = "ไม่พบข้อมูล — ตรวจเบอร์หรือเลขบัตรที่ใช้ตอนสมัครอีกครั้ง หรือติดต่อทีมงาน"

// เบอร์ตัวแทนที่ทีมงานใส่ในชีทแทนคนที่ไม่มีเบอร์ ห้ามให้ค้นแล้วเจอคนหลายคนรวมกัน
const PLACEHOLDER_PHONE = phoneKey("0123456789")

// ── จำกัดจำนวนครั้ง: เก็บในหน่วยความจำของโปรเซส พอสำหรับเซิร์ฟเวอร์เดียวบน Plesk ──
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 10
const hits = new Map<string, number[]>()

function rateLimited(ip: string) {
    const now = Date.now()
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
    if (recent.length >= MAX_PER_WINDOW) {
        hits.set(ip, recent)
        return true
    }
    recent.push(now)
    hits.set(ip, recent)
    // กันแผนที่โตไม่หยุด — ล้างทั้งก้อนเป็นครั้งคราว (คนที่โดนจำกัดอยู่จะได้เริ่มนับใหม่ ไม่เป็นไร)
    if (hits.size > 5000) hits.clear()
    return false
}

async function clientIp() {
    const h = await headers()
    // อยู่หลัง Cloudflare → Plesk nginx ค่าจริงอยู่ที่ cf-connecting-ip ก่อน
    return (
        h.get("cf-connecting-ip") ??
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        h.get("x-real-ip") ??
        "unknown"
    )
}

/** "กฤตนัย สิทธิวัฒน์" → "กฤ••• สิ•••" — ตัดตามตัวอักษรที่มองเห็น ไม่ตัดสระ/วรรณยุกต์ไทยขาดกลาง */
function maskName(name: string | null) {
    if (!name) return "-"
    const seg = new Intl.Segmenter("th", { granularity: "grapheme" })
    return name
        .trim()
        .split(/\s+/)
        .map((word) => {
            const chars = [...seg.segment(word)].map((s) => s.segment)
            return chars.length <= 2 ? chars[0] + "•" : chars.slice(0, 2).join("") + "•••"
        })
        .join(" ")
}

export async function lookupRunner(
    query: string
): Promise<{ ok: true; data: RunnerLookupResult[] } | { ok: false; error: string }> {
    const digits = String(query ?? "").replace(/\D/g, "")
    const isPhone = digits.length === 10 && digits.startsWith("0")
    const isNationalId = digits.length === 13
    if (!isPhone && !isNationalId) {
        return { ok: false, error: "กรอกเบอร์โทร 10 หลัก หรือเลขบัตรประชาชน 13 หลัก" }
    }

    if (rateLimited(await clientIp())) {
        return { ok: false, error: "ค้นหาบ่อยเกินไป รอสักครู่แล้วลองใหม่" }
    }

    const key = isPhone ? phoneKey(digits) : nationalIdKey(digits)
    if (!key || key === PLACEHOLDER_PHONE) return { ok: false, error: NOT_FOUND }

    const candidates = await prisma.registration.findMany({
        where: {
            status: "PAID",
            event: lookupEventWhere(),
            ...(isPhone ? { phone: { not: null } } : { nationalId: { not: null } }),
        },
        select: {
            phone: true,
            nationalId: true,
            fullName: true,
            bib: true,
            shirtSize: true,
            pickupStatus: true,
            event: { select: { title: true, date: true } },
            category: { select: { name: true } },
        },
    })

    const matches = candidates.filter((r) =>
        isPhone ? phoneKey(r.phone) === key : nationalIdKey(r.nationalId) === key
    )
    if (matches.length === 0) return { ok: false, error: NOT_FOUND }

    return {
        ok: true,
        data: matches
            .sort((a, b) => (a.bib ?? "").localeCompare(b.bib ?? ""))
            .map((r) => ({
                eventTitle: r.event.title,
                eventDate: formatDate(r.event.date),
                categoryName: r.category?.name ?? null,
                maskedName: maskName(r.fullName),
                bib: r.bib,
                shirtSize: r.shirtSize,
                pickupStatus: r.pickupStatus,
            })),
    }
}

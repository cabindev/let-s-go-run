'use server'

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { heldSeatWhere, expireStaleRegistrations, paymentDeadline } from "@/lib/expiry"
import { requireUserAction } from "@/lib/auth-helpers"
import { registerState, toOptions, SHIRT_SIZES, NATIONAL_ID_PATTERN, registrationAmount } from "@/lib/events"
import type { ActionResult } from "./registration"

const schema = z.object({
    eventId: z.string().min(1),
    categoryId: z.string().optional().or(z.literal("")),
    fullName: z.string().trim().min(1, "กรุณากรอกชื่อ-นามสกุล").max(120),
    phone: z.string().trim().min(8, "เบอร์โทรศัพท์ไม่ถูกต้อง").max(20),
    shirtSize: z.enum(SHIRT_SIZES),
    address: z.string().trim().max(400).optional().or(z.literal("")),
    emergencyName: z.string().trim().max(120).optional().or(z.literal("")),
    emergencyPhone: z.string().trim().max(20).optional().or(z.literal("")),
    gender: z.enum(["MALE", "FEMALE", "LGBTQ"]).optional().or(z.literal("")),
    bloodType: z.enum(["O", "A", "B", "AB"]).optional().or(z.literal("")),
    nationalId: z.string().trim().regex(NATIONAL_ID_PATTERN, "เลขบัตรประชาชนไม่ถูกต้อง").optional().or(z.literal("")),
    hasParticipatedBefore: z.enum(["YES", "NO"]).optional().or(z.literal("")),
    deliveryMethod: z.enum(["PICKUP", "SHIPPING"]).optional().or(z.literal("")),
})

export type SubmitResult =
    | { ok: true; registrationId: string; needsPayment: boolean }
    | { ok: false; error: string }

/** ยืนยันการสมัคร — สร้าง Registration แล้วคืน id เพื่อพาไปขั้นชำระเงิน */
export async function submitRegistration(formData: FormData): Promise<SubmitResult> {
    try {
        const user = await requireUserAction()

        // ปล่อยที่นั่งที่หมดเวลาก่อน จะได้นับที่ว่างตามจริง
        await expireStaleRegistrations()

        const parsed = schema.safeParse({
            eventId: formData.get("eventId"),
            categoryId: formData.get("categoryId"),
            fullName: formData.get("fullName"),
            phone: formData.get("phone"),
            shirtSize: formData.get("shirtSize"),
            address: formData.get("address"),
            emergencyName: formData.get("emergencyName"),
            emergencyPhone: formData.get("emergencyPhone"),
            gender: formData.get("gender"),
            bloodType: formData.get("bloodType"),
            nationalId: formData.get("nationalId"),
            hasParticipatedBefore: formData.get("hasParticipatedBefore"),
            deliveryMethod: formData.get("deliveryMethod"),
        })

        if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
        const d = parsed.data

        const event = await prisma.event.findUnique({
            where: { id: d.eventId },
            include: {
                categories: true,
                _count: { select: { registrations: { where: heldSeatWhere() } } },
            },
        })
        if (!event) return { ok: false, error: "ไม่พบกิจกรรมนี้" }

        const state = registerState(event, event._count.registrations)
        if (!state.open) return { ok: false, error: state.reason }

        // ฟิลด์เสริม — บังคับกรอกเฉพาะเมื่องานนี้เปิดเก็บไว้ (เพศ/กรุ๊ปเลือดไม่บังคับแม้เปิดเก็บ)
        if (event.collectNationalId && !d.nationalId) {
            return { ok: false, error: "กรุณากรอกเลขบัตรประชาชน" }
        }
        if (event.collectPreviousParticipation && !d.hasParticipatedBefore) {
            return { ok: false, error: "กรุณาระบุว่าเคยเข้าร่วมกิจกรรมนี้มาก่อนหรือไม่" }
        }
        if (formData.get("pdpaConsent") !== "1") {
            return { ok: false, error: "กรุณายอมรับข้อความ PDPA ก่อนสมัคร" }
        }

        // ตัวเลือกรับของ — สนใจค่านี้เฉพาะงานที่เปิดไว้จริง (กันส่งมาเองทั้งที่งานไม่ได้เปิด)
        const deliveryMethod = event.offerShipping ? (d.deliveryMethod || null) : null
        if (event.offerShipping && !deliveryMethod) {
            return { ok: false, error: "กรุณาเลือกวิธีรับของ" }
        }
        if (deliveryMethod === "SHIPPING" && !d.address) {
            return { ok: false, error: "กรุณากรอกที่อยู่จัดส่งสำหรับการส่งไปรษณีย์" }
        }

        // ตรวจว่าประเภทที่เลือกเป็นของงานนี้จริง
        const options = toOptions(event, event.categories)
        const chosen = options.find((o) => (o.id ?? "") === (d.categoryId ?? ""))
        if (!chosen) return { ok: false, error: "กรุณาเลือกประเภทการแข่งขัน" }

        // ฟรี = ยืนยันทันที / มีค่าสมัคร (รวมค่าส่งไปรษณีย์ถ้าเลือก) = รอชำระเงิน
        const amount = registrationAmount(chosen.price, deliveryMethod)
        const needsPayment = amount > 0
        const status = needsPayment ? "PENDING" : "PAID"

        // มีค่าสมัคร = ต้องจ่ายให้เสร็จภายในเวลาที่กำหนด ไม่งั้นระบบคืนที่นั่ง
        const expiresAt = needsPayment ? paymentDeadline() : null

        const baseData = {
            categoryId: chosen.id,
            status,
            expiresAt,
            fullName: d.fullName,
            phone: d.phone,
            shirtSize: d.shirtSize,
            address: d.address || null,
            emergencyName: d.emergencyName || null,
            emergencyPhone: d.emergencyPhone || null,
            gender: d.gender || null,
            bloodType: d.bloodType || null,
            nationalId: d.nationalId || null,
            hasParticipatedBefore: d.hasParticipatedBefore ? d.hasParticipatedBefore === "YES" : null,
            deliveryMethod,
            pdpaConsentAt: new Date(),
            note: null,
            paidAt: needsPayment ? null : new Date(),
        } as const

        // เช็กที่นั่งว่าง + สมัครซ้ำ + บันทึก ทั้งหมดในทรานแซกชันเดียว ล็อกแถวงานไว้ก่อน (FOR UPDATE)
        // กันคนสมัครพร้อมกันแย่งที่นั่งเกินจำนวนที่กำหนด (ทั้งของงานรวมและของประเภท — race condition
        // แบบเดียวกับที่เคยพบใน BIB counter: เดิมนับที่นั่งแล้วค่อยเช็ค ไม่ atomic จึงเผื่อคนเข้าพร้อมกันเกินโควตาได้)
        const outcome = await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM Event WHERE id = ${d.eventId} FOR UPDATE`

            if (event.maxParticipants) {
                const joined = await tx.registration.count({
                    where: { eventId: d.eventId, ...heldSeatWhere() },
                })
                if (joined >= event.maxParticipants) {
                    return { ok: false as const, error: "จำนวนผู้สมัครเต็มแล้ว" }
                }
            }

            if (chosen.id && chosen.maxSlots) {
                const taken = await tx.registration.count({
                    where: { categoryId: chosen.id, ...heldSeatWhere() },
                })
                if (taken >= chosen.maxSlots) {
                    return { ok: false as const, error: `ประเภท "${chosen.name}" เต็มแล้ว` }
                }
            }

            const existing = await tx.registration.findUnique({
                where: { userId_eventId: { userId: user.id, eventId: d.eventId } },
            })
            // สมัครใหม่ได้ถ้ารายการเดิมถูกยกเลิกหรือหมดเวลาไปแล้ว
            if (existing && !["CANCELLED", "EXPIRED"].includes(existing.status)) {
                return { ok: false as const, error: "คุณสมัครงานนี้ไว้แล้ว" }
            }

            // งานฟรียืนยันทันที จึงออก BIB ให้เลย — เพิ่มเลขในทรานแซกชันเดียวกัน (ไม่เรียก issueBib
            // เพราะมันเปิด connection แยก จะไปรอแถว Event ที่ทรานแซกชันนี้ล็อกไว้เองจนเดดล็อก)
            let bib: string | null = null
            if (!needsPayment) {
                if (existing?.bib) {
                    bib = existing.bib
                } else {
                    const updated = await tx.event.update({
                        where: { id: d.eventId },
                        data: { bibCounter: { increment: 1 } },
                        select: { bibCounter: true },
                    })
                    bib = String(updated.bibCounter).padStart(4, "0")
                }
            }

            const reg = existing
                ? await tx.registration.update({
                    where: { id: existing.id },
                    data: { ...baseData, bib, registeredAt: new Date() },
                })
                : await tx.registration.create({
                    data: { ...baseData, bib, userId: user.id, eventId: d.eventId },
                })

            return { ok: true as const, reg }
        })

        if (!outcome.ok) return { ok: false, error: outcome.error }

        revalidatePath(`/events/${d.eventId}`)
        revalidatePath("/profile")
        revalidatePath("/")

        return { ok: true, registrationId: outcome.reg.id, needsPayment }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "สมัครไม่สำเร็จ" }
    }
}

/** จำนวนที่นั่งที่ถูกจองไปแล้วของแต่ละประเภท */
export async function getTakenSlots(eventId: string): Promise<Record<string, number>> {
    const rows = await prisma.registration.groupBy({
        by: ["categoryId"],
        where: { eventId, categoryId: { not: null }, ...heldSeatWhere() },
        _count: { _all: true },
    })
    return Object.fromEntries(rows.map((r) => [r.categoryId!, r._count._all]))
}

export type { ActionResult }

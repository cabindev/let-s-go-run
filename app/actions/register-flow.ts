'use server'

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { publicSeatWhere, expireStaleRegistrations, paymentDeadline } from "@/lib/expiry"
import { requireUserAction } from "@/lib/auth-helpers"
import { registerState, toOptions, SHIRT_SIZES, NATIONAL_ID_PATTERN, registrationAmount } from "@/lib/events"
import { discountedPrice, inviteCodeState, normalizeInviteCode } from "@/lib/invite-codes"
import { sendRegistrationPlacedEmail, sendRegistrationPaidEmail } from "@/lib/mail"
import { formString } from "@/lib/utils"
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
    gender: z.enum(["MALE", "FEMALE"]).optional().or(z.literal("")),
    bloodType: z.enum(["O", "A", "B", "AB"]).optional().or(z.literal("")),
    nationalId: z.string().trim().regex(NATIONAL_ID_PATTERN, "เลขบัตรประชาชนไม่ถูกต้อง").optional().or(z.literal("")),
    hasParticipatedBefore: z.enum(["YES", "NO"]).optional().or(z.literal("")),
    deliveryMethod: z.enum(["PICKUP", "SHIPPING"]).optional().or(z.literal("")),
    dateOfBirth: z.string().trim().optional().or(z.literal("")),
    hasMedicalCondition: z.enum(["YES", "NO"]).optional().or(z.literal("")),
    medicalConditionDetail: z.string().trim().max(400).optional().or(z.literal("")),
    inviteCode: z.string().trim().max(40).optional().or(z.literal("")),
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
            dateOfBirth: formData.get("dateOfBirth"),
            hasMedicalCondition: formData.get("hasMedicalCondition"),
            medicalConditionDetail: formData.get("medicalConditionDetail"),
            inviteCode: formString(formData, "inviteCode"),
        })

        if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
        const d = parsed.data

        const event = await prisma.event.findUnique({
            where: { id: d.eventId },
            include: {
                categories: true,
                _count: { select: { registrations: { where: publicSeatWhere() } } },
            },
        })
        if (!event) return { ok: false, error: "ไม่พบกิจกรรมนี้" }

        // โค้ดสิทธิพิเศษ — ตรวจก่อนทุกอย่าง เพราะมีผลกับทั้งราคา วิธีรับของ และเช็คโควตา
        // ถ้าใส่โค้ดมาแล้วใช้ไม่ได้ ต้องตีกลับให้รู้ตัว ห้ามเงียบแล้วคิดเต็มราคา —
        // คนถือโค้ดคือแขกที่เราเชิญมาเอง จะให้เขาจ่ายเงินโดยไม่รู้ตัวไม่ได้
        let invite: { id: string; groupName: string; discountPercent: number } | null = null
        if (d.inviteCode) {
            const found = await prisma.inviteCode.findUnique({
                where: { code: normalizeInviteCode(d.inviteCode) },
            })
            if (!found || found.eventId !== d.eventId) {
                return { ok: false, error: "ไม่พบรหัสสิทธิพิเศษนี้ในงานนี้" }
            }
            const codeState = inviteCodeState(found)
            if (!codeState.ok) return { ok: false, error: codeState.reason }
            invite = { id: found.id, groupName: found.groupName, discountPercent: found.discountPercent }
        }

        // คนถือโค้ดข้ามเช็ค "เต็มแล้ว" ได้ เพราะที่นั่งสิทธิพิเศษอยู่นอกโควตาที่ประกาศไว้
        // แต่เงื่อนไขอื่น (ปิดรับสมัคร/ยกเลิก/เลยวันงาน) ยังบังคับเท่ากันทุกคน
        const state = registerState(event, event._count.registrations, new Date(), {
            ignoreCapacity: !!invite,
        })
        if (!state.open) return { ok: false, error: state.reason }

        // ฟิลด์เสริม — บังคับกรอกเฉพาะเมื่องานนี้เปิดเก็บไว้ (เพศ/กรุ๊ปเลือดไม่บังคับแม้เปิดเก็บ)
        if (event.collectNationalId && !d.nationalId) {
            return { ok: false, error: "กรุณากรอกเลขบัตรประชาชน" }
        }
        if (event.collectPreviousParticipation && !d.hasParticipatedBefore) {
            return { ok: false, error: "กรุณาระบุว่าเคยเข้าร่วมกิจกรรมนี้มาก่อนหรือไม่" }
        }
        if (event.collectDateOfBirth && !d.dateOfBirth) {
            return { ok: false, error: "กรุณากรอกวันเกิด" }
        }
        if (event.collectBloodType && !d.hasMedicalCondition) {
            return { ok: false, error: "กรุณาระบุว่ามีโรคประจำตัวหรือไม่" }
        }
        if (d.hasMedicalCondition === "YES" && !d.medicalConditionDetail) {
            return { ok: false, error: "กรุณาระบุรายละเอียดโรคประจำตัว" }
        }
        if (formData.get("pdpaConsent") !== "1") {
            return { ok: false, error: "กรุณายอมรับข้อความ PDPA ก่อนสมัคร" }
        }

        // ตรวจว่าประเภทที่เลือกเป็นของงานนี้จริง
        const options = toOptions(event, event.categories)
        const chosen = options.find((o) => (o.id ?? "") === (d.categoryId ?? ""))
        if (!chosen) return { ok: false, error: "กรุณาเลือกประเภทการแข่งขัน" }

        // ราคาหลังส่วนลด — อ่านเปอร์เซ็นต์จากฐานข้อมูลเท่านั้น ไม่รับตัวเลขใด ๆ จาก client
        const price = invite ? discountedPrice(chosen.price, invite.discountPercent) : chosen.price

        // สิทธิพิเศษที่ทำให้ค่าสมัครเป็นศูนย์ = รับของที่งานเท่านั้น
        //
        // ทับค่าฝั่งเซิร์ฟเวอร์เสมอ ไม่ใช่แค่ซ่อนตัวเลือกบนหน้าจอ — ไม่งั้นยิงฟอร์มตรง ๆ
        // ด้วย deliveryMethod=SHIPPING จะได้ทั้งค่าสมัครฟรีและค่าส่งฟรี
        //
        // เงื่อนไขผูกกับ "ยอดเป็นศูนย์" ไม่ใช่ "เป็นโค้ดสปอนเซอร์" กติกาเดียวจึงคุมได้ทั้ง
        // โค้ดฟรี 100% (ต้องรับหน้างาน) และโค้ดลดบางส่วน (ยังส่งไปรษณีย์ได้ จ่ายค่าส่งตามปกติ)
        const forcePickup = !!invite && price <= 0

        const deliveryMethod = !event.offerShipping
            ? null
            : forcePickup
                ? "PICKUP"
                : (d.deliveryMethod || null)

        if (event.offerShipping && !deliveryMethod) {
            return { ok: false, error: "กรุณาเลือกวิธีรับของ" }
        }
        if (deliveryMethod === "SHIPPING" && !d.address) {
            return { ok: false, error: "กรุณากรอกที่อยู่จัดส่งสำหรับการส่งไปรษณีย์" }
        }

        // ฟรี = ยืนยันทันที / มีค่าสมัคร (รวมค่าส่งไปรษณีย์ถ้าเลือก) = รอชำระเงิน
        const amount = registrationAmount(price, deliveryMethod)
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
            hasMedicalCondition: event.collectBloodType && d.hasMedicalCondition ? d.hasMedicalCondition === "YES" : null,
            medicalConditionDetail: d.hasMedicalCondition === "YES" ? (d.medicalConditionDetail || null) : null,
            deliveryMethod,
            pdpaConsentAt: new Date(),
            note: null,
            paidAt: needsPayment ? null : new Date(),
            inviteCodeId: invite?.id ?? null,
            inviteGroupName: invite?.groupName ?? null,
        } as const

        // เช็กที่นั่งว่าง + สมัครซ้ำ + บันทึก ทั้งหมดในทรานแซกชันเดียว ล็อกแถวงานไว้ก่อน (FOR UPDATE)
        // กันคนสมัครพร้อมกันแย่งที่นั่งเกินจำนวนที่กำหนด (ทั้งของงานรวมและของประเภท — race condition
        // แบบเดียวกับที่เคยพบใน BIB counter: เดิมนับที่นั่งแล้วค่อยเช็ค ไม่ atomic จึงเผื่อคนเข้าพร้อมกันเกินโควตาได้)
        const outcome = await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM Event WHERE id = ${d.eventId} FOR UPDATE`

            // ผู้ถือโค้ดข้ามโควตาทั้งของงานและของรุ่น
            //
            // ต้องข้ามทั้งคู่ให้สอดคล้องกัน ถ้าข้ามยอดรวมแต่ยังติดโควตารุ่น สปอนเซอร์ที่อยากวิ่ง
            // รุ่นที่เต็มแล้วจะใช้สิทธิ์ที่เราสัญญาไว้ไม่ได้ ต้องโทรให้แอดมินไปขยาย maxSlots ทีละครั้ง
            //
            // ส่วนเกินไม่บานปลาย เพราะมีเพดานเท่าจำนวนสิทธิ์ที่ออกไว้เสมอ — หน้าแอดมินโชว์
            // ยอดรวมจริงรายรุ่นไว้ให้ใช้ประเมินเสื้อ/เหรียญ/คลื่นปล่อยตัว
            if (!invite) {
                if (event.maxParticipants) {
                    const joined = await tx.registration.count({
                        where: { eventId: d.eventId, ...publicSeatWhere() },
                    })
                    if (joined >= event.maxParticipants) {
                        return { ok: false as const, error: "จำนวนผู้สมัครเต็มแล้ว" }
                    }
                }

                if (chosen.id && chosen.maxSlots) {
                    const taken = await tx.registration.count({
                        where: { categoryId: chosen.id, ...publicSeatWhere() },
                    })
                    if (taken >= chosen.maxSlots) {
                        return { ok: false as const, error: `ประเภท "${chosen.name}" เต็มแล้ว` }
                    }
                }
            }

            const existing = await tx.registration.findUnique({
                where: { userId_eventId: { userId: user.id, eventId: d.eventId } },
            })
            // สมัครใหม่ได้ถ้ารายการเดิมถูกยกเลิกหรือหมดเวลาไปแล้ว
            if (existing && !["CANCELLED", "EXPIRED"].includes(existing.status)) {
                return { ok: false as const, error: "คุณสมัครงานนี้ไว้แล้ว" }
            }

            // ตัดสิทธิ์จากโค้ดแบบมีเงื่อนไข — ต้องอยู่ **หลัง** เช็คสมัครซ้ำ ไม่งั้นคนกดซ้ำจะเผาสิทธิ์ทิ้ง
            //
            // เช็ค usedCount ใน WHERE แล้วดูว่า updateMany เปลี่ยนได้จริงกี่แถว (แพตเทิร์นเดียวกับ
            // ตัดสต็อกสินค้า) — อ่านค่ามาเทียบก่อนแล้วค่อยเขียนจะกันคนกดพร้อมกันไม่ได้
            // 20 สิทธิ์ต้องเป็น 20 เสมอ ต่อให้ทั้งบริษัทกดพร้อมกัน
            if (invite) {
                const claimed = await tx.inviteCode.updateMany({
                    where: { id: invite.id, active: true, usedCount: { lt: prisma.inviteCode.fields.maxUses } },
                    data: { usedCount: { increment: 1 } },
                })
                if (claimed.count !== 1) {
                    return { ok: false as const, error: "รหัสนี้ถูกใช้ครบจำนวนแล้ว" }
                }
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

        // อัปเดตวันเกิดเข้าโปรไฟล์ผู้ใช้ — เป็นข้อมูลระดับคน ไม่ใช่ต่อการสมัครครั้งเดียว จึงไม่ต้อง atomic กับการจองที่นั่ง
        if (event.collectDateOfBirth && d.dateOfBirth) {
            await prisma.user.update({
                where: { id: user.id },
                data: { dateOfBirth: new Date(d.dateOfBirth) },
            })
        }

        // อีเมลยืนยันส่งหลังทรานแซกชันจบ และห้ามทำให้การสมัครล้มถ้าส่งไม่ออก
        // งานฟรียืนยันทันทีตั้งแต่ตอนสมัคร จึงส่งฉบับ "ยืนยันแล้ว" ไปเลย ไม่ต้องรอ webhook
        try {
            const mailReg = {
                id: outcome.reg.id,
                eventTitle: event.title,
                eventDate: event.date,
                categoryName: chosen.id ? chosen.name : null,
                amount,
                bib: outcome.reg.bib,
                expiresAt,
                deliveryMethod,
            }
            if (needsPayment) await sendRegistrationPlacedEmail(user.email ?? "", mailReg)
            else await sendRegistrationPaidEmail(user.email ?? "", mailReg)
        } catch (e) {
            console.error("[register] ส่งอีเมลยืนยันการสมัครไม่สำเร็จ:", e)
        }

        revalidatePath(`/events/${d.eventId}`)
        revalidatePath("/profile")
        revalidatePath("/")

        return { ok: true, registrationId: outcome.reg.id, needsPayment }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "สมัครไม่สำเร็จ" }
    }
}

/**
 * จำนวนที่นั่งที่ถูกจองไปแล้วของแต่ละประเภท — เฉพาะที่กินโควตาสาธารณะ
 * (ผู้สมัครที่ใช้โค้ดสิทธิพิเศษไม่นับ ตัวเลขที่คนทั่วไปเห็นจึงตรงกับจำนวนที่เขาแย่งกันจริง)
 */
export async function getTakenSlots(eventId: string): Promise<Record<string, number>> {
    const rows = await prisma.registration.groupBy({
        by: ["categoryId"],
        where: { eventId, categoryId: { not: null }, ...publicSeatWhere() },
        _count: { _all: true },
    })
    return Object.fromEntries(rows.map((r) => [r.categoryId!, r._count._all]))
}

export type { ActionResult }

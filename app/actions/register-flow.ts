'use server'

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { heldSeatWhere, expireStaleRegistrations, paymentDeadline } from "@/lib/expiry"
import { requireUserAction } from "@/lib/auth-helpers"
import { registerState, toOptions, SHIRT_SIZES } from "@/lib/events"
import { withBib } from "@/lib/vr"
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

        // ตรวจว่าประเภทที่เลือกเป็นของงานนี้จริง
        const options = toOptions(event, event.categories)
        const chosen = options.find((o) => (o.id ?? "") === (d.categoryId ?? ""))
        if (!chosen) return { ok: false, error: "กรุณาเลือกประเภทการแข่งขัน" }

        // ที่นั่งของประเภทนั้นเต็มหรือยัง
        if (chosen.id && chosen.maxSlots) {
            const taken = await prisma.registration.count({
                where: { categoryId: chosen.id, ...heldSeatWhere() },
            })
            if (taken >= chosen.maxSlots) return { ok: false, error: `ประเภท "${chosen.name}" เต็มแล้ว` }
        }

        const existing = await prisma.registration.findUnique({
            where: { userId_eventId: { userId: user.id, eventId: d.eventId } },
        })
        // สมัครใหม่ได้ถ้ารายการเดิมถูกยกเลิกหรือหมดเวลาไปแล้ว
        if (existing && !["CANCELLED", "EXPIRED"].includes(existing.status)) {
            return { ok: false, error: "คุณสมัครงานนี้ไว้แล้ว" }
        }

        // ฟรี = ยืนยันทันที / มีค่าสมัคร = รอชำระเงิน
        const needsPayment = chosen.price > 0
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
            slipUrl: null,
            note: null,
            paidAt: needsPayment ? null : new Date(),
        } as const

        const save = (bib: string | null) =>
            existing
                ? prisma.registration.update({
                    where: { id: existing.id },
                    data: { ...baseData, bib, registeredAt: new Date() },
                })
                : prisma.registration.create({
                    data: { ...baseData, bib, userId: user.id, eventId: d.eventId },
                })

        // งานฟรียืนยันทันที จึงออก BIB ให้เลย — ใช้ withBib กันเลขชนกันถ้ามีคนสมัครพร้อมกัน
        const reg = needsPayment ? await save(null) : await withBib(d.eventId, existing?.bib ?? null, save)

        revalidatePath(`/events/${d.eventId}`)
        revalidatePath("/profile")
        revalidatePath("/")

        return { ok: true, registrationId: reg.id, needsPayment }
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

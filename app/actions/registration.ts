'use server'

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { heldSeatWhere } from "@/lib/expiry"
import { requireUserAction } from "@/lib/auth-helpers"

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

/** ลงทะเบียนเข้าร่วมกิจกรรม */
export async function registerForEvent(eventId: string): Promise<ActionResult> {
    try {
        const user = await requireUserAction()

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: { _count: { select: { registrations: { where: heldSeatWhere() } } } },
        })

        if (!event) return { ok: false, error: "ไม่พบกิจกรรมนี้" }
        if (event.status !== "OPEN") return { ok: false, error: "กิจกรรมนี้ปิดรับสมัครแล้ว" }
        if (event.date < new Date()) return { ok: false, error: "กิจกรรมนี้จัดไปแล้ว" }
        if (event.maxParticipants && event._count.registrations >= event.maxParticipants) {
            return { ok: false, error: "จำนวนผู้สมัครเต็มแล้ว" }
        }

        const existing = await prisma.registration.findUnique({
            where: { userId_eventId: { userId: user.id, eventId } },
        })

        if (existing && !["CANCELLED", "EXPIRED"].includes(existing.status)) {
            return { ok: false, error: "คุณลงทะเบียนกิจกรรมนี้ไว้แล้ว" }
        }

        // กิจกรรมฟรี = ยืนยันทันที / มีค่าสมัคร = รอชำระเงิน
        const status = event.price > 0 ? "PENDING" : "PAID"

        if (existing) {
            await prisma.registration.update({
                where: { id: existing.id },
                data: { status, note: null, paidAt: status === "PAID" ? new Date() : null, registeredAt: new Date() },
            })
        } else {
            await prisma.registration.create({
                data: { userId: user.id, eventId, status, paidAt: status === "PAID" ? new Date() : null },
            })
        }

        revalidatePath(`/events/${eventId}`)
        revalidatePath("/profile")
        revalidatePath("/")
        return { ok: true, message: event.price > 0 ? "ลงทะเบียนแล้ว กรุณาชำระเงิน" : "ลงทะเบียนสำเร็จ" }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "เกิดข้อผิดพลาด" }
    }
}

/** ยกเลิกการลงทะเบียน */
export async function cancelRegistration(registrationId: string): Promise<ActionResult> {
    try {
        const user = await requireUserAction()

        const reg = await prisma.registration.findUnique({
            where: { id: registrationId },
            include: { event: { select: { id: true, date: true } } },
        })

        if (!reg || reg.userId !== user.id) return { ok: false, error: "ไม่พบรายการลงทะเบียน" }
        if (reg.status === "CANCELLED" || reg.status === "EXPIRED") {
            return { ok: false, error: "รายการนี้สิ้นสุดไปแล้ว" }
        }
        if (reg.event.date < new Date()) return { ok: false, error: "กิจกรรมจัดไปแล้ว ยกเลิกไม่ได้" }

        await prisma.registration.update({
            where: { id: registrationId },
            data: { status: "CANCELLED" },
        })

        revalidatePath(`/events/${reg.event.id}`)
        revalidatePath("/profile")
        return { ok: true, message: "ยกเลิกการลงทะเบียนแล้ว" }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "เกิดข้อผิดพลาด" }
    }
}

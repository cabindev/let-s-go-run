'use server'

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { publicSeatWhere, releaseInviteSeat } from "@/lib/expiry"
import { requireUserAction } from "@/lib/auth-helpers"

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

/** ลงทะเบียนเข้าร่วมกิจกรรม */
export async function registerForEvent(eventId: string): Promise<ActionResult> {
    try {
        const user = await requireUserAction()

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: { _count: { select: { registrations: { where: publicSeatWhere() } } } },
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

        // เปลี่ยนสถานะแบบมีเงื่อนไข แล้วคืนสิทธิ์โค้ดเฉพาะเมื่อเปลี่ยนได้จริง —
        // กดยกเลิกรัว ๆ สองครั้งพร้อมกันต้องไม่คืนสิทธิ์ให้สปอนเซอร์งอกเกินที่ออกไว้
        //
        // เงื่อนไขเขียนเป็น "สถานะที่ยังยกเลิกได้" ไม่ใช่สถานะที่อ่านมาก่อนหน้า เพราะค่าที่อ่าน
        // มาอยู่นอกทรานแซกชัน ถ้าใช้ค่านั้นตรง ๆ การเรียกซ้ำบนรายการที่ยกเลิกไปแล้วจะ
        // "ยกเลิกซ้ำได้สำเร็จ" แล้วคืนสิทธิ์รอบสอง — ตอนนี้ตัดเงื่อนไขนั้นทิ้งได้เอง
        const cancelled = await prisma.$transaction(async (tx) => {
            const { count } = await tx.registration.updateMany({
                where: { id: registrationId, status: { notIn: ["CANCELLED", "EXPIRED"] } },
                data: { status: "CANCELLED" },
            })
            if (count !== 1) return false
            await releaseInviteSeat(tx, reg.inviteCodeId)
            return true
        })
        if (!cancelled) return { ok: false, error: "รายการนี้สิ้นสุดไปแล้ว" }

        revalidatePath(`/events/${reg.event.id}`)
        revalidatePath("/profile")
        return { ok: true, message: "ยกเลิกการลงทะเบียนแล้ว" }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "เกิดข้อผิดพลาด" }
    }
}

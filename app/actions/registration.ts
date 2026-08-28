'use server'

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { heldSeatWhere } from "@/lib/expiry"
import { requireUserAction } from "@/lib/auth-helpers"
import { saveImage } from "@/lib/upload"

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
                data: { status, slipUrl: null, note: null, paidAt: status === "PAID" ? new Date() : null, registeredAt: new Date() },
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

/** อัปโหลดสลิปแจ้งโอนเงิน */
export async function uploadSlip(formData: FormData): Promise<ActionResult> {
    try {
        const user = await requireUserAction()

        const registrationId = String(formData.get("registrationId") || "")
        const file = formData.get("slip")

        if (!(file instanceof File) || file.size === 0) {
            return { ok: false, error: "กรุณาเลือกไฟล์สลิป" }
        }

        const reg = await prisma.registration.findUnique({
            where: { id: registrationId },
            select: { userId: true, status: true, eventId: true, expiresAt: true },
        })

        if (!reg || reg.userId !== user.id) return { ok: false, error: "ไม่พบรายการลงทะเบียน" }
        if (reg.status === "PAID") return { ok: false, error: "รายการนี้ยืนยันการชำระเงินแล้ว" }
        if (reg.status === "CANCELLED") return { ok: false, error: "รายการนี้ถูกยกเลิกแล้ว" }
        if (reg.status === "EXPIRED" || (reg.expiresAt && reg.expiresAt <= new Date())) {
            return { ok: false, error: "หมดเวลาชำระเงินแล้ว กรุณาสมัครใหม่อีกครั้ง" }
        }

        const { url: slipUrl } = await saveImage(file, "slips")

        await prisma.registration.update({
            where: { id: registrationId },
            // ส่งสลิปแล้ว = หยุดนาฬิกา รอแอดมินตรวจ
            data: { slipUrl, status: "WAITING", note: null, expiresAt: null },
        })

        revalidatePath(`/payment/${registrationId}`)
        revalidatePath(`/events/${reg.eventId}`)
        revalidatePath("/profile")
        revalidatePath("/admin/slips")
        return { ok: true, message: "ส่งสลิปเรียบร้อย รอแอดมินตรวจสอบ" }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ" }
    }
}

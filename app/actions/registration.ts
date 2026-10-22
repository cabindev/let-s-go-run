'use server'

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { releaseInviteSeat } from "@/lib/expiry"
import { requireUserAction } from "@/lib/auth-helpers"

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

// การสมัครทั้งหมดผ่าน app/actions/register-flow.ts (ตัวเดียวที่เช็คโควตา/ประเภท/PDPA และออกเลข BIB)

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

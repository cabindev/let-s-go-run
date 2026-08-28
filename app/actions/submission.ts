'use server'

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireUserAction, requireAdminAction } from "@/lib/auth-helpers"
import { saveImage } from "@/lib/upload"
import { submissionWindow, submitState, targetOf } from "@/lib/vr"
import { recalculateUserStats } from "@/lib/stats"
import { unlockAchievements } from "@/lib/achievements"
import type { ActionResult } from "./registration"

const schema = z.object({
    registrationId: z.string().min(1),
    distance: z.coerce.number().gt(0, "ระยะทางต้องมากกว่า 0").max(500, "ระยะทางต่อครั้งไม่ควรเกิน 500 กม."),
    runDate: z.string().min(1, "กรุณาเลือกวันที่วิ่ง"),
    note: z.string().trim().max(200).optional().or(z.literal("")),
})

/** ส่งผลวิ่งของงานประเภท VIRTUAL — บันทึกแล้วขึ้นทันที */
export async function submitRun(formData: FormData): Promise<ActionResult> {
    try {
        const user = await requireUserAction()

        const parsed = schema.safeParse({
            registrationId: formData.get("registrationId"),
            distance: formData.get("distance"),
            runDate: formData.get("runDate"),
            note: formData.get("note"),
        })
        if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
        const d = parsed.data

        const reg = await prisma.registration.findUnique({
            where: { id: d.registrationId },
            include: {
                event: true,
                category: { select: { distance: true } },
                submissions: { select: { distance: true } },
            },
        })

        if (!reg || reg.userId !== user.id) return { ok: false, error: "ไม่พบรายการลงทะเบียน" }
        if (reg.event.type !== "VIRTUAL") return { ok: false, error: "งานนี้ไม่ต้องส่งผลวิ่ง" }
        if (reg.status !== "PAID") return { ok: false, error: "ต้องยืนยันการชำระเงินก่อนจึงจะส่งผลได้" }

        const state = submitState(reg.event)
        if (!state.open) return { ok: false, error: state.reason }

        // สะสมครบเป้าหมายแล้ว ไม่ต้องส่งเพิ่ม
        const target = targetOf({ category: reg.category, event: reg.event })
        const total = reg.submissions.reduce((s, x) => s + x.distance, 0)
        if (target > 0 && total >= target) {
            return { ok: false, error: "สะสมครบเป้าหมายแล้ว ไม่ต้องส่งผลเพิ่ม" }
        }

        // วันที่วิ่งต้องอยู่ในช่วงกิจกรรม และไม่เป็นอนาคต
        const runDate = new Date(d.runDate)
        const { start, end } = submissionWindow(reg.event)
        const startOfDay = new Date(start); startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(end); endOfDay.setHours(23, 59, 59, 999)

        if (runDate < startOfDay || runDate > endOfDay) {
            return { ok: false, error: "วันที่วิ่งต้องอยู่ในช่วงของกิจกรรม" }
        }
        if (runDate > new Date()) return { ok: false, error: "วันที่วิ่งเป็นอนาคตไม่ได้" }

        // บังคับแนบหลักฐานทุกครั้ง — กันการกรอกตัวเลขลอยๆ โดยไม่มีอะไรยืนยัน (อ้างอิงเงื่อนไขของ ThaiRun
        // ที่กำหนดให้ต้องบันทึกผลผ่านแอป/อุปกรณ์ที่กำหนดจึงจะนับระยะได้)
        const file = formData.get("evidence")
        if (!(file instanceof File) || file.size === 0) {
            return { ok: false, error: "กรุณาแนบภาพหลักฐาน (จากนาฬิกา แอปวิ่ง หรือหน้าจอลู่วิ่ง)" }
        }
        const evidenceUrl = (await saveImage(file, "results")).url

        await prisma.runSubmission.create({
            data: {
                registrationId: reg.id,
                distance: d.distance,
                runDate,
                evidenceUrl,
                note: d.note || null,
            },
        })

        // ระยะสะสมของผู้ใช้เปลี่ยน — คำนวณใหม่และตรวจความสำเร็จ
        await recalculateUserStats(user.id)
        await unlockAchievements(user.id)

        revalidatePath(`/virtual/${reg.eventId}`)
        revalidatePath(`/virtual/${reg.eventId}/submit`)
        revalidatePath("/profile")
        revalidatePath("/leaderboard")
        return { ok: true, message: `บันทึกผล ${d.distance} กม. แล้ว` }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "ส่งผลไม่สำเร็จ" }
    }
}

/** ผู้ใช้ลบผลของตัวเองได้ (เช่นกรอกผิด) */
export async function deleteOwnSubmission(id: string): Promise<ActionResult> {
    try {
        const user = await requireUserAction()

        const sub = await prisma.runSubmission.findUnique({
            where: { id },
            include: { registration: { select: { userId: true, eventId: true } } },
        })
        if (!sub || sub.registration.userId !== user.id) return { ok: false, error: "ไม่พบผลนี้" }

        await prisma.runSubmission.delete({ where: { id } })
        await recalculateUserStats(user.id)

        revalidatePath(`/virtual/${sub.registration.eventId}`)
        revalidatePath(`/virtual/${sub.registration.eventId}/submit`)
        revalidatePath("/profile")
        revalidatePath("/leaderboard")
        return { ok: true, message: "ลบผลแล้ว" }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "ลบไม่สำเร็จ" }
    }
}

/** ผู้ดูแลระบบลบผลที่ไม่ถูกต้องออกได้ */
export async function deleteSubmissionAsAdmin(id: string): Promise<ActionResult> {
    try {
        await requireAdminAction()

        const sub = await prisma.runSubmission.findUnique({
            where: { id },
            include: { registration: { select: { eventId: true, userId: true } } },
        })
        if (!sub) return { ok: false, error: "ไม่พบผลนี้" }

        await prisma.runSubmission.delete({ where: { id } })
        await recalculateUserStats(sub.registration.userId)

        revalidatePath("/admin/submissions")
        revalidatePath(`/virtual/${sub.registration.eventId}`)
        revalidatePath("/leaderboard")
        return { ok: true, message: "ลบผลแล้ว" }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "ลบไม่สำเร็จ" }
    }
}

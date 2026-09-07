'use server'

import { prisma } from "@/lib/prisma"
import { requireUserAction } from "@/lib/auth-helpers"
import { inviteCodeState, normalizeInviteCode } from "@/lib/invite-codes"

export type InviteCodeCheck =
    | { ok: true; code: string; groupName: string; discountPercent: number }
    | { ok: false; error: string }

/**
 * ตรวจโค้ดสิทธิพิเศษให้ผู้สมัครเห็นราคาก่อนกรอกฟอร์ม
 *
 * เป็นแค่ตัวช่วยแสดงผล — ผลลัพธ์จากที่นี่ไม่ถูกเชื่อถือตอนสมัครจริง
 * submitRegistration() ตรวจและตัดสิทธิ์ใหม่ทั้งหมดเองในทรานแซกชันเดียวกับที่จองที่นั่ง
 *
 * ตั้งใจไม่คืน "เหลืออีกกี่สิทธิ์" — เป็นข้อมูลของสปอนเซอร์ ไม่ใช่ของคนที่ถือโค้ดมาใบเดียว
 * และถ้าเผลอคืนไป คนที่เดาโค้ดถูกจะอ่านความเคลื่อนไหวของโควตาได้ด้วย
 */
export async function checkInviteCode(eventId: string, input: string): Promise<InviteCodeCheck> {
    try {
        // บังคับล็อกอินก่อน เพื่อให้การเดาโค้ดผูกกับบัญชีที่ตามตัวได้ ไม่ใช่ยิงมาจากที่ไหนก็ได้
        await requireUserAction()

        const code = normalizeInviteCode(input)
        if (!code) return { ok: false, error: "กรุณากรอกรหัส" }

        const found = await prisma.inviteCode.findUnique({ where: { code } })

        // โค้ดของงานอื่นให้ตอบเหมือนไม่มีอยู่จริง ไม่บอกว่า "โค้ดนี้เป็นของงานอื่น"
        // เพราะนั่นคือการยืนยันให้คนเดาโค้ดรู้ว่าเดาถูกแล้ว
        if (!found || found.eventId !== eventId) {
            return { ok: false, error: "ไม่พบรหัสนี้ กรุณาตรวจสอบอีกครั้ง" }
        }

        const state = inviteCodeState(found)
        if (!state.ok) return { ok: false, error: state.reason }

        return {
            ok: true,
            code: found.code,
            groupName: found.groupName,
            discountPercent: found.discountPercent,
        }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "ตรวจสอบรหัสไม่สำเร็จ" }
    }
}

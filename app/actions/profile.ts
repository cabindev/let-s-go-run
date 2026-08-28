'use server'

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { hash, compare } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { requireUserAction } from "@/lib/auth-helpers"
import { saveImage } from "@/lib/upload"
import type { ActionResult } from "./registration"

const profileSchema = z.object({
    name: z.string().trim().min(1, "กรุณากรอกชื่อ").max(80),
    phone: z.string().trim().max(20).optional().or(z.literal("")),
    bio: z.string().trim().max(300).optional().or(z.literal("")),
    dateOfBirth: z.string().optional().or(z.literal("")),
})

export async function updateProfile(formData: FormData): Promise<ActionResult> {
    try {
        const user = await requireUserAction()

        const parsed = profileSchema.safeParse({
            name: formData.get("name"),
            phone: formData.get("phone"),
            bio: formData.get("bio"),
            dateOfBirth: formData.get("dateOfBirth"),
        })

        if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

        const { name, phone, bio, dateOfBirth } = parsed.data

        let image: string | undefined
        const file = formData.get("image")
        if (file instanceof File && file.size > 0) {
            image = (await saveImage(file, "avatars")).url
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                name,
                phone: phone || null,
                bio: bio || null,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                ...(image ? { image } : {}),
            },
        })

        revalidatePath("/profile")
        revalidatePath("/")
        return { ok: true, message: "บันทึกโปรไฟล์แล้ว" }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" }
    }
}

const passwordSchema = z.object({
    currentPassword: z.string().min(1, "กรุณากรอกรหัสผ่านปัจจุบัน"),
    newPassword: z.string().min(5, "รหัสผ่านใหม่ต้องมีอย่างน้อย 5 ตัวอักษร"),
})

export async function changePassword(formData: FormData): Promise<ActionResult> {
    try {
        const sessionUser = await requireUserAction()

        const parsed = passwordSchema.safeParse({
            currentPassword: formData.get("currentPassword"),
            newPassword: formData.get("newPassword"),
        })
        if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

        const user = await prisma.user.findUnique({ where: { id: sessionUser.id } })
        if (!user?.password) return { ok: false, error: "บัญชีนี้ยังไม่ได้ตั้งรหัสผ่าน" }

        const valid = await compare(parsed.data.currentPassword, user.password)
        if (!valid) return { ok: false, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" }

        await prisma.user.update({
            where: { id: user.id },
            data: { password: await hash(parsed.data.newPassword, 10) },
        })

        return { ok: true, message: "เปลี่ยนรหัสผ่านแล้ว" }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ" }
    }
}

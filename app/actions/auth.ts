'use server'

import { hash } from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { generateResetToken, hashResetToken } from "@/lib/reset-token"
import { sendPasswordResetEmail } from "@/lib/mail"

const registerSchema = z.object({
    name: z.string().trim().min(1, "กรุณากรอกชื่อ"),
    email: z.email("รูปแบบอีเมลไม่ถูกต้อง"),
    password: z.string().min(5, "รหัสผ่านต้องมีอย่างน้อย 5 ตัวอักษร"),
})

export type RegisterInput = z.infer<typeof registerSchema>

export async function register(input: RegisterInput): Promise<{ error?: string }> {
    const parsed = registerSchema.safeParse(input)

    if (!parsed.success) {
        return { error: parsed.error.issues[0].message }
    }

    const { name, email, password } = parsed.data

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
        return { error: "อีเมลนี้ถูกใช้งานแล้ว" }
    }

    const hashedPassword = await hash(password, 10)

    await prisma.user.create({
        data: { name, email, password: hashedPassword },
    })

    return {}
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // ลิงก์รีเซ็ตหมดอายุใน 1 ชั่วโมง

const forgotPasswordSchema = z.object({
    email: z.email("รูปแบบอีเมลไม่ถูกต้อง"),
})

export async function requestPasswordReset(input: { email: string }): Promise<{ error?: string }> {
    const parsed = forgotPasswordSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })

    // ไม่บอกฝั่ง client ว่าอีเมลนี้มีในระบบหรือไม่ (กันสุ่มเช็คว่าใครสมัครไว้บ้าง) — ส่งเมลจริงเฉพาะตอนเจอ user เท่านั้น
    if (user) {
        const { token, tokenHash } = generateResetToken()
        await prisma.user.update({
            where: { id: user.id },
            data: { resetToken: tokenHash, resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
        })

        const origin = process.env.NEXTAUTH_URL || "http://localhost:3000"
        const resetUrl = `${origin}/auth/reset-password?token=${token}`

        try {
            await sendPasswordResetEmail(user.email, resetUrl)
        } catch (e) {
            // ไม่ throw ต่อ — ผู้ใช้ต้องเห็นข้อความเดิมเสมอไม่ว่าจะส่งเมลสำเร็จหรือไม่ (กัน enumeration)
            // แต่ยัง log ไว้ฝั่งเซิร์ฟเวอร์เผื่อ SMTP ตั้งค่าผิด — พ่วงลิงก์ไว้ด้วยเผื่อ dev ยังไม่ได้ตั้ง SMTP จะได้ทดสอบต่อได้
            console.error("[requestPasswordReset] sendPasswordResetEmail failed:", e)
            console.error("[requestPasswordReset] reset link (SMTP ส่งไม่สำเร็จ):", resetUrl)
        }
    }

    return {}
}

const resetPasswordSchema = z.object({
    token: z.string().min(1, "ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้อง"),
    password: z.string().min(5, "รหัสผ่านต้องมีอย่างน้อย 5 ตัวอักษร"),
})

export async function resetPassword(input: { token: string; password: string }): Promise<{ error?: string }> {
    const parsed = resetPasswordSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const user = await prisma.user.findUnique({ where: { resetToken: hashResetToken(parsed.data.token) } })

    if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
        return { error: "ลิงก์รีเซ็ตรหัสผ่านหมดอายุหรือไม่ถูกต้อง กรุณาขอลิงก์ใหม่" }
    }

    const hashedPassword = await hash(parsed.data.password, 10)
    await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword, resetToken: null, resetTokenExpiresAt: null },
    })

    return {}
}

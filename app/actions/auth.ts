'use server'

import { hash } from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

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

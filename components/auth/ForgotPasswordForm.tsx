'use client'

import { useState, FormEvent } from "react"
import Link from "next/link"
import { AuthLayout } from "./AuthLayout"
import { Field } from "@/components/ui/Field"
import { Button, Spinner } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"
import { requestPasswordReset } from "@/app/actions/auth"

export default function ForgotPasswordForm() {
    const [isLoading, setIsLoading] = useState(false)
    const [sent, setSent] = useState(false)

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading(true)

        const data = new FormData(e.currentTarget)
        await requestPasswordReset({ email: String(data.get("email")) })

        setIsLoading(false)
        setSent(true)
    }

    return (
        <AuthLayout
            eyebrow="ลืมรหัสผ่าน"
            title="รีเซ็ตรหัสผ่าน"
            footer={
                <>
                    นึกออกแล้ว?{" "}
                    <Link href="/auth/signin" className="text-ink font-semibold hover:text-ink-soft transition-colors">
                        เข้าสู่ระบบ
                    </Link>
                </>
            }
        >
            {sent ? (
                <Notice tone="lime" title="ส่งลิงก์แล้ว">
                    <p>ถ้าอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้แล้ว ลิงก์จะหมดอายุใน 1 ชั่วโมง</p>
                </Notice>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-7">
                    <p className="text-sm text-ink-soft">กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้</p>
                    <Field label="อีเมล" name="email" id="email" type="email" required autoComplete="email" placeholder="you@example.com" />
                    <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                        {isLoading ? <Spinner /> : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
                    </Button>
                </form>
            )}
        </AuthLayout>
    )
}

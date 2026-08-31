'use client'

import { useState, FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { AuthLayout } from "./AuthLayout"
import { PasswordField } from "./PasswordField"
import { Button, Spinner } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"
import { resetPassword } from "@/app/actions/auth"

export default function ResetPasswordForm() {
    const [error, setError] = useState<string | null>(null)
    const [done, setDone] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams.get("token") ?? ""

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)

        const data = new FormData(e.currentTarget)
        const password = String(data.get("password"))
        const confirm = String(data.get("confirm"))

        if (password !== confirm) {
            setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน")
            return
        }

        setIsLoading(true)
        const result = await resetPassword({ token, password })
        setIsLoading(false)

        if (result.error) setError(result.error)
        else setDone(true)
    }

    if (!token) {
        return (
            <AuthLayout eyebrow="ตั้งรหัสผ่านใหม่" title="ลิงก์ไม่ถูกต้อง" footer={null}>
                <Notice tone="danger" title="ไม่พบลิงก์รีเซ็ตรหัสผ่าน">
                    <p>ลิงก์นี้ไม่สมบูรณ์หรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่อีกครั้ง</p>
                </Notice>
                <Link
                    href="/auth/forgot-password"
                    className="mt-6 inline-block text-ink font-semibold hover:text-ink-soft transition-colors"
                >
                    ขอลิงก์ใหม่
                </Link>
            </AuthLayout>
        )
    }

    if (done) {
        return (
            <AuthLayout eyebrow="ตั้งรหัสผ่านใหม่" title="สำเร็จแล้ว" footer={null}>
                <Notice tone="lime" title="ตั้งรหัสผ่านใหม่เรียบร้อย">
                    <p>เข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย</p>
                </Notice>
                <Button className="w-full mt-6" size="lg" onClick={() => router.replace("/auth/signin")}>
                    ไปหน้าเข้าสู่ระบบ
                </Button>
            </AuthLayout>
        )
    }

    return (
        <AuthLayout
            eyebrow="ตั้งรหัสผ่านใหม่"
            title="รหัสผ่านใหม่"
            footer={
                <>
                    นึกออกแล้ว?{" "}
                    <Link href="/auth/signin" className="text-ink font-semibold hover:text-ink-soft transition-colors">
                        เข้าสู่ระบบ
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-7">
                <PasswordField label="รหัสผ่านใหม่" name="password" id="password" required autoComplete="new-password" placeholder="••••••" />
                <PasswordField label="ยืนยันรหัสผ่านใหม่" name="confirm" id="confirm" required autoComplete="new-password" placeholder="••••••" />

                {error && <Notice tone="danger">{error}</Notice>}

                <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                    {isLoading ? <Spinner /> : "ตั้งรหัสผ่านใหม่"}
                </Button>
            </form>
        </AuthLayout>
    )
}

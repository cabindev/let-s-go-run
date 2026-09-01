'use client'

import { useState, FormEvent } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AuthLayout } from "./AuthLayout"
import { GoogleSignInButton } from "./GoogleSignInButton"
import { PasswordField } from "./PasswordField"
import { Field } from "@/components/ui/Field"
import { Button, Spinner } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"
import { register } from "@/app/actions/auth"

export default function SignUpForm() {
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        setIsLoading(true)

        const data = new FormData(e.currentTarget)
        const email = String(data.get("email"))
        const password = String(data.get("password"))

        try {
            const result = await register({ name: String(data.get("name")), email, password })
            if (result?.error) {
                setError(result.error)
                return
            }

            const signInResult = await signIn("credentials", { redirect: false, email, password })
            if (signInResult?.error) {
                setError("สมัครสำเร็จ แต่เข้าสู่ระบบไม่สำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง")
                return
            }

            router.replace("/")
            router.refresh()
        } catch {
            setError("เกิดข้อผิดพลาด โปรดลองอีกครั้ง")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <AuthLayout
            eyebrow="เริ่มต้นวิ่งไปด้วยกัน"
            title="สมัครสมาชิก"
            footer={
                <>
                    มีบัญชีอยู่แล้ว?{" "}
                    <Link href="/auth/signin" className="text-ink font-semibold hover:text-ink-soft transition-colors">
                        เข้าสู่ระบบ
                    </Link>
                </>
            }
        >
            <div className="space-y-7">
                <GoogleSignInButton />

                <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-line" />
                    <span className="text-[13px] text-ink-mute">หรือ</span>
                    <div className="h-px flex-1 bg-line" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-7">
                    <Field label="ชื่อ-นามสกุล" name="name" id="name" required autoComplete="name" placeholder="ชื่อของคุณ" />
                    <Field label="อีเมล" name="email" id="email" type="email" required autoComplete="email" placeholder="you@example.com" />
                    <PasswordField label="รหัสผ่าน" name="password" id="password" required minLength={5} autoComplete="new-password" placeholder="อย่างน้อย 5 ตัวอักษร" />

                    {error && <Notice tone="danger">{error}</Notice>}

                    <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                        {isLoading ? <Spinner /> : "สมัครสมาชิก"}
                    </Button>
                </form>
            </div>
        </AuthLayout>
    )
}

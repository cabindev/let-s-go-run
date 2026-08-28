'use client'

import { useState, FormEvent } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { AuthLayout } from "./AuthLayout"
import { PasswordField } from "./PasswordField"
import { Field } from "@/components/ui/Field"
import { Button, Spinner } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"

export default function SignInForm() {
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()
    const searchParams = useSearchParams()
    const callbackUrl = searchParams.get("callbackUrl") || "/"

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        setIsLoading(true)

        const data = new FormData(e.currentTarget)

        try {
            const result = await signIn("credentials", {
                redirect: false,
                email: String(data.get("email")),
                password: String(data.get("password")),
            })

            if (result?.error) {
                setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง")
            } else {
                router.replace(callbackUrl)
                router.refresh()
            }
        } catch {
            setError("เกิดข้อผิดพลาด โปรดลองอีกครั้ง")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <AuthLayout
            eyebrow="ยินดีต้อนรับกลับ"
            title="เข้าสู่ระบบ"
            footer={
                <>
                    ยังไม่มีบัญชี?{" "}
                    <Link href="/auth/signup" className="text-ink font-semibold hover:text-ink-soft transition-colors">
                        สมัครสมาชิก
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-7">
                <Field label="อีเมล" name="email" id="email" type="email" required autoComplete="email" placeholder="you@example.com" />
                <PasswordField label="รหัสผ่าน" name="password" id="password" required autoComplete="current-password" placeholder="••••••" />

                {error && <Notice tone="move">{error}</Notice>}

                <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                    {isLoading ? <Spinner /> : "เข้าสู่ระบบ"}
                </Button>
            </form>
        </AuthLayout>
    )
}

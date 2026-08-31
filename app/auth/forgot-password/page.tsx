import { Suspense } from "react"
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm"

export const metadata = { title: "ลืมรหัสผ่าน · RunLudtong" }

export default function ForgotPasswordPage() {
    return (
        <Suspense>
            <ForgotPasswordForm />
        </Suspense>
    )
}

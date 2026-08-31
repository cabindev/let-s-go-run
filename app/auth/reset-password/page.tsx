import { Suspense } from "react"
import ResetPasswordForm from "@/components/auth/ResetPasswordForm"

export const metadata = { title: "ตั้งรหัสผ่านใหม่ · RunLudtong" }

export default function ResetPasswordPage() {
    return (
        <Suspense>
            <ResetPasswordForm />
        </Suspense>
    )
}

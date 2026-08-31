'use client'

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Role } from "@prisma/client"
import { setUserRole } from "@/app/actions/admin"
import { Spinner } from "@/components/ui/Button"
import { cn } from "@/lib/utils"

export function RoleToggle({ userId, role, disabled }: { userId: string; role: Role; disabled?: boolean }) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    const toggle = () => {
        setError(null)
        startTransition(async () => {
            const res = await setUserRole(userId, role === "ADMIN" ? "USER" : "ADMIN")
            if (!res.ok) setError(res.error)
            else router.refresh()
        })
    }

    if (disabled) {
        return <span className="eyebrow text-ink-mute">คุณเอง</span>
    }

    return (
        <div className="text-right">
            <button
                type="button"
                onClick={toggle}
                disabled={pending}
                title={role === "ADMIN" ? "ลดสิทธิ์เป็นผู้ใช้ทั่วไป" : "เลื่อนเป็นผู้ดูแลระบบ"}
                className={cn(
                    "px-3 h-8 inline-flex items-center rounded-full text-[11px] font-bold uppercase tracking-[0.1em] transition-colors disabled:opacity-50",
                    role === "ADMIN"
                        ? "bg-ink text-paper-2 hover:bg-ink/85"
                        : "bg-paper-2 text-ink-soft hover:text-ink"
                )}
            >
                {pending ? <Spinner /> : role === "ADMIN" ? "แอดมิน" : "ผู้ใช้"}
            </button>
            {error && <p className="text-[11px] text-danger mt-1">{error}</p>}
        </div>
    )
}

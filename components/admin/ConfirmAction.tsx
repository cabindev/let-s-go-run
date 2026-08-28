'use client'

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button, Spinner } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"

interface Props {
    action: () => Promise<{ ok: boolean; error?: string }>
    title: string
    message: string
    confirmLabel?: string
    children: React.ReactNode
    className?: string
}

/** ปุ่มที่เปิดกล่องยืนยันก่อนเรียก server action — ไม่ใช้ window.confirm */
export function ConfirmAction({ action, title, message, confirmLabel = "ยืนยัน", children, className }: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()

    const run = () => {
        setError(null)
        startTransition(async () => {
            const res = await action()
            if (!res.ok) setError(res.error ?? "เกิดข้อผิดพลาด")
            else {
                setOpen(false)
                router.refresh()
            }
        })
    }

    return (
        <>
            <button type="button" onClick={() => setOpen(true)} className={className}>
                {children}
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
                    <div className="absolute inset-0 bg-ink/25 backdrop-blur-sm" onClick={() => !pending && setOpen(false)} aria-hidden />
                    <div role="alertdialog" aria-modal="true" className="relative w-full max-w-sm bg-paper border border-line rounded-3xl p-6 animate-rise shadow-2xl shadow-black/15">
                        <p className="display text-lg">{title}</p>
                        <p className="text-sm text-ink-soft mt-2 leading-relaxed">{message}</p>

                        {error && <Notice tone="move" className="mt-4">{error}</Notice>}

                        <div className="flex gap-2 mt-6">
                            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={pending}>
                                ยกเลิก
                            </Button>
                            <Button variant="danger" className="flex-1" onClick={run} disabled={pending}>
                                {pending ? <Spinner /> : confirmLabel}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

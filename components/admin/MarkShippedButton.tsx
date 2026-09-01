'use client'

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button, Spinner } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"
import { confirmPickupAdmin } from "@/app/actions/admin"

/** ปุ่มบันทึกว่าส่งไปรษณีย์แล้ว — สำหรับผู้ที่เลือกรับทางไปรษณีย์ตอนสมัคร ไม่ต้องสแกน QR หน้างาน */
export function MarkShippedButton({ registrationId, name }: { registrationId: string; name: string }) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [trackingNo, setTrackingNo] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()

    const run = () => {
        setError(null)
        startTransition(async () => {
            const fd = new FormData()
            fd.set("registrationId", registrationId)
            fd.set("method", "SHIPPED")
            fd.set("trackingNo", trackingNo)
            const res = await confirmPickupAdmin(fd)
            if (!res.ok) {
                setError(res.error)
                return
            }
            setOpen(false)
            router.refresh()
        })
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="eyebrow text-ink-mute hover:text-ink transition-colors"
            >
                บันทึกว่าส่งแล้ว
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
                    <div className="absolute inset-0 bg-ink/25 backdrop-blur-sm" onClick={() => !pending && setOpen(false)} aria-hidden />
                    <div role="alertdialog" aria-modal="true" className="relative w-full max-w-sm bg-paper border border-line rounded-3xl p-6 animate-rise shadow-2xl shadow-black/15">
                        <p className="display text-lg">บันทึกว่าส่งไปรษณีย์แล้ว</p>
                        <p className="text-sm text-ink-soft mt-2 leading-relaxed">{name} — เลือกรับทางไปรษณีย์ไว้ตอนสมัคร</p>

                        <input
                            type="text"
                            value={trackingNo}
                            onChange={(e) => setTrackingNo(e.target.value)}
                            placeholder="เลขพัสดุ (ไม่บังคับ)"
                            className="w-full h-11 px-3 mt-4 rounded-xl border border-line text-sm bg-transparent focus:outline-none focus:border-ink"
                        />

                        {error && <Notice tone="danger" className="mt-4">{error}</Notice>}

                        <div className="flex gap-2 mt-6">
                            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={pending}>
                                ยกเลิก
                            </Button>
                            <Button className="flex-1" onClick={run} disabled={pending}>
                                {pending ? <Spinner /> : "ยืนยัน"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

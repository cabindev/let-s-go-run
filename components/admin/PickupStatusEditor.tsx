'use client'

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button, Spinner } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"
import { confirmPickupAdmin } from "@/app/actions/admin"
import { cn } from "@/lib/utils"

const OPTIONS = [
    { value: "PENDING", label: "ยังไม่รับ" },
    { value: "PICKED_UP", label: "รับที่บูธแล้ว" },
    { value: "SHIPPED", label: "ส่งไปรษณีย์แล้ว" },
] as const

/**
 * แก้ไขสถานะรับของตรงในตารางรายการสมัคร — ใช้เป็นทางสำรองเวลาสแกน QR ไม่ได้
 * (ไม่มีการเซ็นลายเซ็นตรงนี้ เพราะเป็นการแก้ไขด้วยมือ ไม่ใช่ตอนผู้สมัครยืนอยู่ตรงหน้า)
 */
export function PickupStatusEditor({
    registrationId, name, currentStatus, currentTrackingNo,
}: {
    registrationId: string
    name: string
    currentStatus: string
    currentTrackingNo: string | null
}) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [status, setStatus] = useState(currentStatus)
    const [trackingNo, setTrackingNo] = useState(currentTrackingNo ?? "")
    const [error, setError] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()

    const run = () => {
        setError(null)
        startTransition(async () => {
            const fd = new FormData()
            fd.set("registrationId", registrationId)
            fd.set("method", status)
            if (status === "SHIPPED") fd.set("trackingNo", trackingNo)
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
                แก้ไขสถานะ
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
                    <div className="absolute inset-0 bg-ink/25 backdrop-blur-sm" onClick={() => !pending && setOpen(false)} aria-hidden />
                    <div role="alertdialog" aria-modal="true" className="relative w-full max-w-sm bg-paper border border-line rounded-3xl p-6 animate-rise shadow-2xl shadow-black/15">
                        <p className="display text-lg">แก้ไขสถานะรับของ</p>
                        <p className="text-sm text-ink-soft mt-2 leading-relaxed">{name}</p>

                        <div className="space-y-2 mt-4">
                            {OPTIONS.map((o) => (
                                <label
                                    key={o.value}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-2xl border cursor-pointer transition-colors",
                                        status === o.value ? "border-ink bg-paper-2" : "border-line"
                                    )}
                                >
                                    <input
                                        type="radio"
                                        name="pickupStatus"
                                        value={o.value}
                                        checked={status === o.value}
                                        onChange={() => setStatus(o.value)}
                                    />
                                    <span className="text-sm font-medium">{o.label}</span>
                                </label>
                            ))}
                        </div>

                        {status === "SHIPPED" && (
                            <input
                                type="text"
                                value={trackingNo}
                                onChange={(e) => setTrackingNo(e.target.value)}
                                placeholder="เลขพัสดุ (ไม่บังคับ)"
                                className="w-full h-11 px-3 mt-3 rounded-xl border border-line text-sm bg-transparent focus:outline-none focus:border-ink"
                            />
                        )}

                        {error && <Notice tone="danger" className="mt-4">{error}</Notice>}

                        <div className="flex gap-2 mt-6">
                            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={pending}>
                                ยกเลิก
                            </Button>
                            <Button className="flex-1" onClick={run} disabled={pending}>
                                {pending ? <Spinner /> : "บันทึก"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

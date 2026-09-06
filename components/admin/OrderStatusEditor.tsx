'use client'

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { OrderStatus } from "@prisma/client"
import { Button, Spinner } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"
import { updateOrderStatus } from "@/app/actions/shop-admin"
import { ORDER_STATUS } from "@/lib/shop"
import { ORDER_STATUSES } from "@/lib/shop-order-query"
import { cn } from "@/lib/utils"

/** สถานะที่แอดมินตั้งเองไม่ได้ — ระบบตั้งให้จากการชำระเงินหรือตัวกวาดหมดอายุ */
const SYSTEM_ONLY: OrderStatus[] = ["PENDING", "EXPIRED"]

const RESTORES_STOCK: OrderStatus[] = ["CANCELLED", "REFUNDED"]

/** แก้สถานะออเดอร์ + เลขพัสดุตรงในรายการ (ล้อ PickupStatusEditor ของฝั่งสมัครวิ่ง) */
export function OrderStatusEditor({
    orderId,
    orderNo,
    currentStatus,
    currentTrackingNo,
    currentNote,
}: {
    orderId: string
    orderNo: string
    currentStatus: OrderStatus
    currentTrackingNo: string | null
    currentNote: string | null
}) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [status, setStatus] = useState<OrderStatus>(currentStatus)
    const [trackingNo, setTrackingNo] = useState(currentTrackingNo ?? "")
    const [adminNote, setAdminNote] = useState(currentNote ?? "")
    const [error, setError] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()

    const options = ORDER_STATUSES.filter((s) => !SYSTEM_ONLY.includes(s) || s === currentStatus)

    const run = () => {
        setError(null)
        startTransition(async () => {
            const fd = new FormData()
            fd.set("status", status)
            fd.set("trackingNo", trackingNo)
            fd.set("adminNote", adminNote)
            const res = await updateOrderStatus(orderId, fd)
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
                จัดการออเดอร์
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
                    <div
                        className="absolute inset-0 bg-ink/25 backdrop-blur-sm"
                        onClick={() => !pending && setOpen(false)}
                        aria-hidden
                    />
                    <div
                        role="alertdialog"
                        aria-modal="true"
                        className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto bg-paper border border-line rounded-3xl p-6 animate-rise shadow-2xl shadow-black/15"
                    >
                        <p className="display text-lg">จัดการออเดอร์</p>
                        <p className="text-sm text-ink-soft mt-2 tnum">{orderNo}</p>

                        <div className="space-y-2 mt-4">
                            {options.map((s) => (
                                <label
                                    key={s}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-2xl border cursor-pointer transition-colors",
                                        status === s ? "border-ink bg-paper-2" : "border-line"
                                    )}
                                >
                                    <input
                                        type="radio"
                                        name="orderStatus"
                                        value={s}
                                        checked={status === s}
                                        onChange={() => setStatus(s)}
                                    />
                                    <span className="text-sm font-medium">{ORDER_STATUS[s].label}</span>
                                </label>
                            ))}
                        </div>

                        {RESTORES_STOCK.includes(status) && status !== currentStatus && (
                            <Notice tone="danger" className="mt-3">
                                สินค้าในออเดอร์นี้จะถูกคืนเข้าสต็อกให้คนอื่นซื้อต่อได้
                            </Notice>
                        )}

                        <input
                            type="text"
                            value={trackingNo}
                            onChange={(e) => setTrackingNo(e.target.value)}
                            placeholder="เลขพัสดุ (ไม่บังคับ)"
                            maxLength={60}
                            className="w-full h-11 px-3 mt-3 rounded-xl border border-line text-sm bg-transparent focus:outline-none focus:border-ink"
                        />

                        <input
                            type="text"
                            value={adminNote}
                            onChange={(e) => setAdminNote(e.target.value)}
                            placeholder="บันทึกภายใน (ไม่บังคับ)"
                            maxLength={400}
                            className="w-full h-11 px-3 mt-2 rounded-xl border border-line text-sm bg-transparent focus:outline-none focus:border-ink"
                        />

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

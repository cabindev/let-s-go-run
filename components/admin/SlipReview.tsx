'use client'

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { approveSlip, rejectSlip } from "@/app/actions/admin"
import { Button, Spinner } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"
import { inputClass } from "@/components/ui/Field"

export function SlipReview({ registrationId }: { registrationId: string }) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [rejecting, setRejecting] = useState(false)
    const [note, setNote] = useState("")

    const approve = () => {
        setError(null)
        startTransition(async () => {
            const res = await approveSlip(registrationId)
            if (!res.ok) setError(res.error)
            else router.refresh()
        })
    }

    const reject = () => {
        setError(null)
        const fd = new FormData()
        fd.set("note", note)
        startTransition(async () => {
            const res = await rejectSlip(registrationId, fd)
            if (!res.ok) setError(res.error)
            else {
                setRejecting(false)
                setNote("")
                router.refresh()
            }
        })
    }

    return (
        <div className="space-y-3">
            {error && <Notice tone="move">{error}</Notice>}

            {rejecting ? (
                <div className="space-y-3">
                    <label htmlFor={`note-${registrationId}`} className="eyebrow block">
                        เหตุผลที่ไม่ผ่าน (ผู้ใช้จะเห็นข้อความนี้)
                    </label>
                    <textarea
                        id={`note-${registrationId}`}
                        rows={2}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="ยอดเงินไม่ตรงกับค่าสมัคร"
                        className={`${inputClass} py-2 resize-y`}
                    />
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => setRejecting(false)} disabled={pending}>
                            ยกเลิก
                        </Button>
                        <Button variant="danger" size="sm" className="flex-1" onClick={reject} disabled={pending || !note.trim()}>
                            {pending ? <Spinner /> : "ยืนยันไม่ผ่าน"}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex gap-2">
                    <Button size="md" className="flex-1" onClick={approve} disabled={pending}>
                        {pending ? <Spinner /> : "อนุมัติ"}
                    </Button>
                    <Button variant="outline" size="md" className="flex-1" onClick={() => setRejecting(true)} disabled={pending}>
                        ไม่ผ่าน
                    </Button>
                </div>
            )}
        </div>
    )
}

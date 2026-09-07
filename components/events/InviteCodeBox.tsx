'use client'

import { useState, useTransition } from "react"
import { checkInviteCode } from "@/app/actions/invite-code"
import { Button, Spinner } from "@/components/ui/Button"
import { inputClass } from "@/components/ui/Field"
import { discountLabel } from "@/lib/invite-codes"

export interface AppliedInvite {
    code: string
    groupName: string
    discountPercent: number
}

/**
 * ช่องกรอกรหัสสิทธิพิเศษ — พับไว้เป็นลิงก์เล็ก ๆ โดยตั้งใจ
 *
 * ห้ามทำเป็นแบนเนอร์หรือปุ่มเด่น: คนที่จ่ายค่าสมัครเต็มไปแล้วเห็นป้ายส่วนลดกลางหน้าสมัคร
 * จะรู้สึกว่าจ่ายแพงกว่าคนอื่นโดยไม่รู้ตัว ซึ่งเป็นข้อผิดพลาดที่แพลตฟอร์มงานวิ่งเตือนไว้ตรง ๆ
 * คนที่ไม่มีรหัสควรกวาดตาผ่านไปได้โดยไม่สะดุด ส่วนคนที่มีรหัสรู้อยู่แล้วว่าต้องมองหาอะไร
 */
export function InviteCodeBox({
    eventId,
    applied,
    onApply,
}: {
    eventId: string
    applied: AppliedInvite | null
    onApply: (invite: AppliedInvite | null) => void
}) {
    const [open, setOpen] = useState(false)
    const [value, setValue] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()

    const submit = () => {
        setError(null)
        startTransition(async () => {
            const res = await checkInviteCode(eventId, value)
            if (!res.ok) {
                setError(res.error)
                onApply(null)
                return
            }
            onApply({ code: res.code, groupName: res.groupName, discountPercent: res.discountPercent })
            setValue("")
            setOpen(false)
        })
    }

    if (applied) {
        return (
            <div className="rounded-2xl border border-lime bg-lime/5 px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[13px] font-semibold tracking-tight">
                        สิทธิพิเศษ — {applied.groupName}
                    </p>
                    <p className="text-[12px] text-ink-mute mt-0.5">
                        {discountLabel(applied.discountPercent)}
                        {applied.discountPercent >= 100 && " · รับของที่งานเท่านั้น"}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => onApply(null)}
                    className="eyebrow text-ink-mute hover:text-ink transition-colors shrink-0"
                >
                    เอาออก
                </button>
            </div>
        )
    }

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="text-[13px] text-ink-mute hover:text-ink transition-colors underline underline-offset-4 decoration-line"
            >
                มีรหัสสิทธิพิเศษ?
            </button>
        )
    }

    return (
        <div className="rounded-2xl border border-line bg-paper px-4 py-4 space-y-3">
            <label htmlFor="inviteCode" className="eyebrow block">
                รหัสสิทธิพิเศษ
            </label>
            <div className="flex gap-2">
                <input
                    id="inviteCode"
                    value={value}
                    autoFocus
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={40}
                    placeholder="เช่น K7M2PQXA"
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault()
                            submit()
                        }
                    }}
                    className={`${inputClass} h-11 font-mono tracking-[0.15em] uppercase`}
                />
                <Button type="button" onClick={submit} disabled={pending || !value.trim()} className="shrink-0">
                    {pending ? <Spinner /> : "ตรวจสอบ"}
                </Button>
            </div>
            {error && <p className="text-[12px] text-danger">{error}</p>}
            <button
                type="button"
                onClick={() => { setOpen(false); setError(null) }}
                className="eyebrow text-ink-mute hover:text-ink transition-colors"
            >
                ปิด
            </button>
        </div>
    )
}

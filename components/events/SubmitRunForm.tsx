'use client'

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import type { RunSubmission } from "@prisma/client"
import { submitRun, deleteOwnSubmission } from "@/app/actions/submission"
import { Button, Spinner } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { Bar } from "@/components/ui/Rings"
import { Field, TextArea } from "@/components/ui/Field"
import { ConfirmAction } from "@/components/admin/ConfirmAction"
import { formatDate, formatNumber } from "@/lib/utils"

interface Props {
    registrationId: string
    target: number
    total: number
    submissions: RunSubmission[]
    /** ช่วงวันที่ที่ส่งผลได้ (yyyy-mm-dd) */
    minDate: string
    maxDate: string
}

export function SubmitRunForm({ registrationId, target, total, submissions, minDate, maxDate }: Props) {
    const router = useRouter()
    const formRef = useRef<HTMLFormElement>(null)
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [preview, setPreview] = useState<string | null>(null)

    const percent = target > 0 ? Math.min(100, (total / target) * 100) : 0
    const remaining = Math.max(0, target - total)

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        setSuccess(null)
        const fd = new FormData(e.currentTarget)
        fd.set("registrationId", registrationId)

        startTransition(async () => {
            const res = await submitRun(fd)
            if (!res.ok) setError(res.error)
            else {
                setSuccess(res.message ?? "บันทึกผลแล้ว")
                setPreview(null)
                formRef.current?.reset()
                router.refresh()
            }
        })
    }

    return (
        <div className="space-y-10">
            {/* ความคืบหน้า */}
            <Card className="p-5 sm:p-6">
                <div className="flex items-baseline justify-between gap-4">
                    <div>
                        <p className="eyebrow">สะสมแล้ว</p>
                        <p className="numeral text-3xl mt-1.5">
                            {formatNumber(total, 2)}
                            <span className="text-[0.4em] font-semibold tracking-normal text-ink-mute ml-1">
                                / {formatNumber(target, 2)} กม.
                            </span>
                        </p>
                    </div>
                    <p className={`numeral text-2xl ${percent >= 100 ? "text-lime" : ""}`}>
                        {formatNumber(percent, 0)}
                        <span className="text-[0.5em] font-semibold tracking-normal text-ink-mute ml-0.5">%</span>
                    </p>
                </div>
                <Bar value={percent} color={percent >= 100 ? "var(--ring-lime)" : "var(--color-ink)"} className="mt-4" />
                <p className="text-[11px] text-ink-mute mt-3 tnum">
                    {remaining > 0 ? `เหลืออีก ${formatNumber(remaining, 2)} กม.` : "สะสมครบเป้าหมายแล้ว 🎉 ส่งเพิ่มได้อีก"}
                </p>
            </Card>

            {/* ฟอร์มส่งผล */}
            <form ref={formRef} onSubmit={onSubmit} className="space-y-7">
                <p className="eyebrow">ส่งผลวิ่ง</p>

                <div className="grid sm:grid-cols-2 gap-7">
                    <Field
                        label="ระยะทาง (กม.)" name="distance" type="number" step="any" min="0.01" max="500" required
                        placeholder="5.20"
                    />
                    <Field
                        label="วันที่วิ่ง" name="runDate" type="date" required
                        min={minDate} max={maxDate}
                        // ใช้ค่าที่คำนวณมาจากเซิร์ฟเวอร์ ไม่เรียก new Date() ที่นี่
                        // เพราะนาฬิกา/timezone ของเบราว์เซอร์อาจให้คนละวันกับตอน SSR
                        defaultValue={maxDate}
                    />
                </div>

                <div>
                    <p className="eyebrow mb-2">หลักฐาน (ถ้ามี)</p>
                    <label
                        htmlFor="evidence"
                        className="flex flex-col items-center justify-center gap-2 w-full min-h-32 p-5 rounded-3xl border border-dashed border-line hover:border-ink-mute cursor-pointer transition-colors"
                    >
                        {preview ? (
                            <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={preview} alt="หลักฐาน" className="max-h-48 rounded-xl object-contain" />
                                <span className="eyebrow text-ink">เปลี่ยนรูป</span>
                            </>
                        ) : (
                            <>
                                <span className="text-sm font-semibold">แนบภาพผลวิ่ง</span>
                                <span className="text-[11px] text-ink-mute">
                                    จากนาฬิกา แอปวิ่ง หรือหน้าจอลู่วิ่ง · ไม่เกิน 5MB
                                </span>
                            </>
                        )}
                    </label>
                    <input
                        id="evidence"
                        type="file"
                        name="evidence"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(e) => {
                            const f = e.target.files?.[0]
                            setPreview(f ? URL.createObjectURL(f) : null)
                        }}
                    />
                </div>

                <TextArea label="บันทึกเพิ่มเติม" name="note" rows={2} maxLength={200} placeholder="เช่น วิ่งรอบสวนตอนเช้า" />

                {error && <Notice tone="move">{error}</Notice>}
                {success && <Notice tone="lime">{success}</Notice>}

                <Button type="submit" size="lg" className="w-full" disabled={pending}>
                    {pending ? <Spinner /> : "ส่งผล"}
                </Button>
            </form>

            {/* ประวัติการส่งผล */}
            <section>
                <div className="flex items-baseline justify-between gap-4 mb-4">
                    <p className="eyebrow">ประวัติการส่งผล</p>
                    <span className="eyebrow tnum">{submissions.length} ครั้ง</span>
                </div>

                {submissions.length === 0 ? (
                    <p className="text-sm text-ink-mute">ยังไม่มีการส่งผล</p>
                ) : (
                    <ul className="divide-y divide-line">
                        {submissions.map((s) => (
                            <li key={s.id} className="flex items-center gap-3 py-3.5">
                                {s.evidenceUrl ? (
                                    <a href={s.evidenceUrl} target="_blank" rel="noreferrer" className="shrink-0">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={s.evidenceUrl} alt="" className="w-12 h-12 rounded-xl object-cover border border-line" />
                                    </a>
                                ) : (
                                    <span className="w-12 h-12 rounded-xl bg-paper-2 border border-line shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="numeral text-base">
                                        {formatNumber(s.distance, 2)}
                                        <span className="text-[0.6em] font-semibold tracking-normal text-ink-mute ml-1">กม.</span>
                                    </p>
                                    <p className="text-[11px] text-ink-mute tnum">{formatDate(s.runDate)}</p>
                                    {s.note && <p className="text-[11px] text-ink-mute truncate">{s.note}</p>}
                                </div>
                                <ConfirmAction
                                    action={deleteOwnSubmission.bind(null, s.id)}
                                    title="ลบผลนี้?"
                                    message={`ผล ${formatNumber(s.distance, 2)} กม. วันที่ ${formatDate(s.runDate)} จะถูกลบออกจากระยะสะสม`}
                                    confirmLabel="ลบ"
                                    className="eyebrow text-ink-mute hover:text-move transition-colors shrink-0"
                                >
                                    ลบ
                                </ConfirmAction>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    )
}

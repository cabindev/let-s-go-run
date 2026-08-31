'use client'

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import type { RaceCategory } from "@prisma/client"
import { createCategory, deleteCategory } from "@/app/actions/admin"
import { Button, Spinner } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"
import { Field } from "@/components/ui/Field"
import { ConfirmAction } from "./ConfirmAction"
import { formatPrice } from "@/lib/utils"

/** จัดการประเภทการแข่งขันของงานหนึ่ง ๆ (ตารางแบบ race.thai.run) */
export function CategoryManager({
    eventId,
    categories,
}: {
    eventId: string
    categories: (RaceCategory & { _count: { registrations: number } })[]
}) {
    const router = useRouter()
    const formRef = useRef<HTMLFormElement>(null)
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [open, setOpen] = useState(categories.length === 0)

    const add = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        const fd = new FormData(e.currentTarget)
        fd.set("eventId", eventId)
        startTransition(async () => {
            const res = await createCategory(fd)
            if (!res.ok) setError(res.error)
            else {
                formRef.current?.reset()
                router.refresh()
            }
        })
    }

    return (
        <section className="space-y-5">
            <div className="flex items-baseline justify-between gap-4">
                <p className="eyebrow">ประเภทการแข่งขัน</p>
                {!open && (
                    <button type="button" onClick={() => setOpen(true)} className="eyebrow text-ink hover:text-ink-soft transition-colors">
                        + เพิ่มประเภท
                    </button>
                )}
            </div>

            {categories.length > 0 && (
                <ul className="divide-y divide-line border-y border-line">
                    {categories.map((c) => (
                        <li key={c.id} className="flex items-center gap-4 py-3">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold tracking-tight truncate">{c.name}</p>
                                <p className="text-[11px] text-ink-mute tnum mt-0.5">
                                    {c.distance} กม.
                                    {c.maxSlots && ` · รับ ${c.maxSlots} ที่`}
                                    {` · สมัครแล้ว ${c._count.registrations}`}
                                </p>
                            </div>
                            <span className="numeral text-base shrink-0">{formatPrice(c.price)}</span>
                            <ConfirmAction
                                action={deleteCategory.bind(null, c.id)}
                                title="ลบประเภทนี้?"
                                message={`"${c.name}" จะถูกลบออกจากงานนี้`}
                                confirmLabel="ลบ"
                                className="eyebrow text-ink-mute hover:text-danger transition-colors shrink-0"
                            >
                                ลบ
                            </ConfirmAction>
                        </li>
                    ))}
                </ul>
            )}

            {open && (
                <form ref={formRef} onSubmit={add} className="bg-paper-2 rounded-2xl p-5 space-y-6">
                    <Field label="ชื่อประเภท" name="name" required maxLength={100} placeholder="เช่น Early Bird 10 กม." />
                    <div className="grid sm:grid-cols-2 gap-6">
                        <Field label="ระยะทาง (กม.)" name="distance" type="number" step="any" min="0" required defaultValue={10} />
                        <Field label="ค่าสมัคร (บาท)" name="price" type="number" step="1" min="0" required defaultValue={0} />
                    </div>
                    <Field label="จำนวนที่รับ" name="maxSlots" type="number" step="1" min="1" placeholder="เว้นว่าง = ไม่จำกัด" />

                    {error && <Notice tone="danger">{error}</Notice>}

                    <div className="flex gap-3">
                        {categories.length > 0 && (
                            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
                                ปิด
                            </Button>
                        )}
                        <Button type="submit" size="sm" disabled={pending}>
                            {pending ? <Spinner /> : "เพิ่มประเภท"}
                        </Button>
                    </div>
                </form>
            )}
        </section>
    )
}

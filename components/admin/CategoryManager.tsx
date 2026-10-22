'use client'

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import type { RaceCategory } from "@prisma/client"
import { createCategory, deleteCategory, updateCategoryBibRange } from "@/app/actions/admin"
import { Button, Spinner } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"
import { Field } from "@/components/ui/Field"
import { ConfirmAction } from "../ui/ConfirmAction"
import { formatPrice } from "@/lib/utils"
import { formatBib } from "@/lib/bib-format"

/** จัดการประเภทการแข่งขันของงานหนึ่ง ๆ (ตารางแบบ race.thai.run) */
export function CategoryManager({
    eventId,
    categories,
    issuedBibs,
}: {
    eventId: string
    categories: (RaceCategory & { _count: { registrations: number } })[]
    /** จำนวน BIB ที่ออกแล้วต่อ categoryId */
    issuedBibs: Record<string, number>
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
                        <li key={c.id} className="flex items-start gap-4 py-3">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold tracking-tight truncate">{c.name}</p>
                                <p className="text-[11px] text-ink-mute tnum mt-0.5">
                                    {c.distance} กม.
                                    {c.maxSlots && ` · รับ ${c.maxSlots} ที่`}
                                    {` · สมัครแล้ว ${c._count.registrations}`}
                                </p>
                                <BibRange category={c} issued={issuedBibs[c.id] ?? 0} />
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

/**
 * ช่วงเลข BIB ของระยะ — แก้ได้จนกว่าจะออกเลขใบแรก
 * ไม่ตั้ง = ใช้เลขรวมของงาน (0001, 0002, ...) ซึ่งก็ไม่ซ้ำทั้งงานอยู่แล้ว
 */
function BibRange({ category: c, issued }: { category: RaceCategory; issued: number }) {
    const router = useRouter()
    const [editing, setEditing] = useState(false)
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    const label =
        c.bibStart != null
            ? `BIB ${formatBib(c.bibPrefix, c.bibStart)}–${c.bibEnd != null ? formatBib(c.bibPrefix, c.bibEnd) : "…"}`
            : "BIB ใช้เลขรวมของงาน"

    const save = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
            const res = await updateCategoryBibRange(c.id, fd)
            if (!res.ok) setError(res.error)
            else {
                setEditing(false)
                router.refresh()
            }
        })
    }

    if (!editing) {
        return (
            <p className="text-[11px] text-ink-mute tnum mt-1">
                {label}
                {issued > 0 ? (
                    ` · ออกแล้ว ${issued} ใบ (ล็อก)`
                ) : (
                    <button type="button" onClick={() => setEditing(true)} className="ml-2 underline hover:text-ink">
                        ตั้งช่วงเลข
                    </button>
                )}
            </p>
        )
    }

    const small = "w-full bg-transparent border-b border-line h-9 text-sm tnum focus:outline-none focus:border-ink"
    return (
        <form onSubmit={save} className="mt-2 bg-paper-2 rounded-xl p-3 space-y-3">
            <div className="grid grid-cols-3 gap-3">
                <label className="block">
                    <span className="text-[10px] text-ink-mute">ตัวอักษรนำ</span>
                    <input name="bibPrefix" defaultValue={c.bibPrefix ?? ""} maxLength={3} placeholder="ไม่มี" className={`${small} uppercase`} />
                </label>
                <label className="block">
                    <span className="text-[10px] text-ink-mute">เริ่มที่เลข</span>
                    <input name="bibStart" type="number" min={1} step={1} defaultValue={c.bibStart ?? ""} placeholder="1001" className={small} />
                </label>
                <label className="block">
                    <span className="text-[10px] text-ink-mute">ถึงเลข</span>
                    <input name="bibEnd" type="number" min={1} step={1} defaultValue={c.bibEnd ?? ""} placeholder="ไม่จำกัด" className={small} />
                </label>
            </div>
            <p className="text-[10px] text-ink-mute leading-relaxed">
                แยกระยะด้วยช่วงเลข เช่น 10 กม. = 1001–1999, 21 กม. = 2001–2999 หรือใช้ตัวอักษรนำ (A, B) — เลขต้องไม่ทับกันในงาน
                และไม่ใส่ความหมายเรื่องเพศ · ออกเลขใบแรกแล้วจะแก้ไม่ได้ · ล้าง “เริ่มที่เลข” = ใช้เลขรวมของงาน
            </p>
            {error && <Notice tone="danger">{error}</Notice>}
            <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)} disabled={pending}>
                    ยกเลิก
                </Button>
                <Button type="submit" size="sm" disabled={pending}>
                    {pending ? <Spinner /> : "บันทึก"}
                </Button>
            </div>
        </form>
    )
}

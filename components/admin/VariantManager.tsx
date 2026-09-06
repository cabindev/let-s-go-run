'use client'

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import type { ProductVariant } from "@prisma/client"
import { createVariant, deleteVariant, updateVariant } from "@/app/actions/shop-admin"
import { Button, Spinner } from "@/components/ui/Button"
import { Badge, Notice } from "@/components/ui/Badge"
import { Field, inputClass } from "@/components/ui/Field"
import { ConfirmAction } from "../ui/ConfirmAction"
import { stockLabel } from "@/lib/shop"
import { formatBaht, formatPrice } from "@/lib/utils"

type VariantWithUse = ProductVariant & { _count: { orderItems: number } }

/** จัดการตัวเลือกและสต็อกของสินค้าหนึ่งตัว — แก้สต็อกได้ในบรรทัดเดียวกันเลย */
export function VariantManager({
    productId,
    productPrice,
    variants,
}: {
    productId: string
    productPrice: number
    variants: VariantWithUse[]
}) {
    const router = useRouter()
    const formRef = useRef<HTMLFormElement>(null)
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [open, setOpen] = useState(variants.length === 0)

    const add = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        const fd = new FormData(e.currentTarget)
        fd.set("productId", productId)
        startTransition(async () => {
            const res = await createVariant(fd)
            if (!res.ok) setError(res.error)
            else {
                formRef.current?.reset()
                router.refresh()
            }
        })
    }

    const totalStock = variants.reduce((sum, v) => sum + (v.stock ?? 0), 0)
    const hasUnlimited = variants.some((v) => v.stock === null)

    return (
        <section className="space-y-5">
            <div className="flex items-baseline justify-between gap-4">
                <div>
                    <p className="eyebrow">ตัวเลือกและสต็อก</p>
                    <p className="text-[11px] text-ink-mute tnum mt-1">
                        {hasUnlimited ? "มีตัวเลือกที่ไม่จำกัดจำนวน" : `รวมคงเหลือ ${totalStock} ชิ้น`}
                    </p>
                </div>
                {!open && (
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="eyebrow text-ink hover:text-ink-soft transition-colors shrink-0"
                    >
                        + เพิ่มตัวเลือก
                    </button>
                )}
            </div>

            {variants.length > 0 && (
                <ul className="divide-y divide-line border-y border-line">
                    {variants.map((v) => (
                        <VariantRow key={v.id} variant={v} productPrice={productPrice} canDelete={variants.length > 1} />
                    ))}
                </ul>
            )}

            {open && (
                <form ref={formRef} onSubmit={add} className="bg-paper-2 rounded-2xl p-5 space-y-6">
                    <Field
                        label="ชื่อตัวเลือก" name="name" required maxLength={80}
                        placeholder="เช่น M (รอบอก 38 นิ้ว) · สีดำ · แพ็ก 2 ชิ้น"
                        helper="สินค้าที่ไม่มีตัวเลือกให้ใส่ว่า &ldquo;มาตรฐาน&rdquo;"
                    />
                    <div className="grid sm:grid-cols-2 gap-6">
                        <Field
                            label="ราคาเฉพาะตัวเลือกนี้" name="price" type="number" step="1" min="0"
                            placeholder="เว้นว่าง = ใช้ราคาสินค้า"
                            helper={`ราคาสินค้าตอนนี้ ${formatBaht(productPrice)}`}
                        />
                        <Field
                            label="จำนวนในสต็อก" name="stock" type="number" step="1" min="0"
                            placeholder="เว้นว่าง = ไม่จำกัด"
                        />
                    </div>

                    {error && <Notice tone="danger">{error}</Notice>}

                    <div className="flex gap-3">
                        {variants.length > 0 && (
                            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
                                ปิด
                            </Button>
                        )}
                        <Button type="submit" size="sm" disabled={pending}>
                            {pending ? <Spinner /> : "เพิ่มตัวเลือก"}
                        </Button>
                    </div>
                </form>
            )}
        </section>
    )
}

/** หนึ่งแถว — แก้ชื่อ/ราคา/สต็อก/เปิด-ปิดขาย แล้วกดบันทึกได้ในที่เดียว */
function VariantRow({
    variant,
    productPrice,
    canDelete,
}: {
    variant: VariantWithUse
    productPrice: number
    canDelete: boolean
}) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [editing, setEditing] = useState(false)

    const save = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
            const res = await updateVariant(variant.id, fd)
            if (!res.ok) setError(res.error)
            else {
                setEditing(false)
                router.refresh()
            }
        })
    }

    const stock = stockLabel(variant.stock)

    if (!editing) {
        return (
            <li className="flex items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold tracking-tight truncate">
                        {variant.name}
                        {!variant.active && <span className="text-ink-mute font-normal"> · ปิดขาย</span>}
                    </p>
                    <p className="text-[11px] text-ink-mute tnum mt-0.5">
                        {variant.price === null ? "ใช้ราคาสินค้า" : "ตั้งราคาเฉพาะตัว"}
                        {variant._count.orderItems > 0 && ` · ขายไปแล้ว ${variant._count.orderItems} รายการ`}
                    </p>
                </div>
                <Badge tone={stock.tone}>{stock.label}</Badge>
                <span className="numeral text-base shrink-0">{formatPrice(variant.price ?? productPrice)}</span>
                <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="eyebrow text-ink-mute hover:text-ink transition-colors shrink-0"
                >
                    แก้ไข
                </button>
                {canDelete && (
                    <ConfirmAction
                        action={deleteVariant.bind(null, variant.id)}
                        title="ลบตัวเลือกนี้?"
                        message={`"${variant.name}" จะถูกลบออกจากสินค้านี้`}
                        confirmLabel="ลบ"
                        className="eyebrow text-ink-mute hover:text-danger transition-colors shrink-0"
                    >
                        ลบ
                    </ConfirmAction>
                )}
            </li>
        )
    }

    return (
        <li className="py-4">
            <form onSubmit={save} className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-4">
                    <label className="block sm:col-span-3">
                        <span className="eyebrow block mb-1.5">ชื่อตัวเลือก</span>
                        <input name="name" required maxLength={80} defaultValue={variant.name} className={`${inputClass} h-11`} />
                    </label>
                    <label className="block">
                        <span className="eyebrow block mb-1.5">ราคาเฉพาะตัวนี้</span>
                        <input
                            name="price" type="number" step="1" min="0"
                            defaultValue={variant.price ?? ""}
                            placeholder="เว้นว่าง = ใช้ราคาสินค้า"
                            className={`${inputClass} h-11`}
                        />
                        {/*
                            ช่องนี้ปล่อยว่างไว้ตั้งใจเมื่อตัวเลือกใช้ราคาสินค้า — ถ้าเติมตัวเลขให้อัตโนมัติ
                            พอกดบันทึกมันจะกลายเป็น "ตั้งราคาเฉพาะตัว" ทันที แล้วเวลาแก้ราคาสินค้าทีหลัง
                            ตัวเลือกนี้จะไม่เปลี่ยนตาม จึงบอกราคาปัจจุบันเป็นข้อความกำกับแทน
                        */}
                        <span className="text-[11px] text-ink-mute mt-1 block tnum">
                            {variant.price === null
                                ? `ตอนนี้ใช้ราคาสินค้า ${formatBaht(productPrice)}`
                                : `ราคาเดิม ${formatBaht(variant.price)} · ลบออกให้ว่างเพื่อกลับไปใช้ราคาสินค้า ${formatBaht(productPrice)}`}
                        </span>
                    </label>
                    <label className="block">
                        <span className="eyebrow block mb-1.5">จำนวนในสต็อก</span>
                        <input
                            name="stock" type="number" step="1" min="0"
                            defaultValue={variant.stock ?? ""}
                            placeholder="เว้นว่าง = ไม่จำกัด"
                            className={`${inputClass} h-11`}
                        />
                        <span className="text-[11px] text-ink-mute mt-1 block tnum">
                            {variant.stock === null ? "ตอนนี้ไม่จำกัดจำนวน" : `คงเหลือตอนนี้ ${variant.stock} ชิ้น`}
                        </span>
                    </label>
                    <label className="flex items-center gap-3 text-sm sm:pt-7">
                        <input type="checkbox" name="active" defaultChecked={variant.active} />
                        เปิดขาย
                    </label>
                </div>

                {error && <Notice tone="danger">{error}</Notice>}

                <div className="flex gap-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)} disabled={pending}>
                        ยกเลิก
                    </Button>
                    <Button type="submit" size="sm" disabled={pending}>
                        {pending ? <Spinner /> : "บันทึก"}
                    </Button>
                </div>
            </form>
        </li>
    )
}

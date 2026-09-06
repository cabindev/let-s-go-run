'use client'

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import type { ProductImage, ProductStatus } from "@prisma/client"
import { addProductImages, deleteProductImage, moveProductImage } from "@/app/actions/shop-admin"
import { Button, Spinner } from "@/components/ui/Button"
import { Badge, Notice } from "@/components/ui/Badge"
import { ConfirmAction } from "../ui/ConfirmAction"
import {
    PRODUCT_IMAGE_GROUPS,
    productGroupField,
    missingRequiredGroups,
    type ProductImageGroup,
} from "@/lib/product-image-groups"
import { cn } from "@/lib/utils"

/** จัดการรูปสินค้า แยกตามหมวด — ด้านหน้า/ด้านหลังบังคับก่อนเปิดขาย */
export function ProductGallery({
    productId,
    status,
    images,
}: {
    productId: string
    status: ProductStatus
    images: ProductImage[]
}) {
    const missing = missingRequiredGroups(images.map((i) => i.category))

    return (
        <section className="space-y-5">
            <div className="flex items-baseline justify-between gap-4">
                <div>
                    <p className="eyebrow">รูปสินค้า</p>
                    <p className="text-[12px] text-ink-mute mt-1">
                        บังคับแค่ด้านหน้ากับด้านหลัง · รูปด้านหน้าใช้เป็นรูปปกบนหน้ารายการสินค้า
                    </p>
                </div>
                <span className="eyebrow tnum shrink-0">{images.length} รูป</span>
            </div>

            {missing.length > 0 && (
                <Notice tone={status === "ACTIVE" ? "danger" : "move"} title={`ยังขาดรูป${missing.join("และ")}`}>
                    <p>
                        {status === "ACTIVE"
                            ? "สินค้านี้เปิดขายอยู่แต่รูปยังไม่ครบ — อัปโหลดให้ครบเพื่อให้ลูกค้าตัดสินใจได้ง่ายขึ้น"
                            : "ต้องมีครบทั้งสองรูปก่อนจึงจะเปลี่ยนสถานะเป็น “เปิดขาย” ได้"}
                    </p>
                </Notice>
            )}

            <div className="space-y-4">
                {PRODUCT_IMAGE_GROUPS.map((g) => (
                    <GroupSection
                        key={g.key}
                        productId={productId}
                        group={g}
                        images={images
                            .filter((i) => i.category === g.key)
                            .sort((a, b) => a.sortOrder - b.sortOrder)}
                    />
                ))}
            </div>
        </section>
    )
}

function GroupSection({
    productId,
    group,
    images,
}: {
    productId: string
    group: ProductImageGroup
    images: ProductImage[]
}) {
    const router = useRouter()
    const inputRef = useRef<HTMLInputElement>(null)
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [picked, setPicked] = useState<string[]>([])

    const id = `add-product-${group.key}`
    const empty = images.length === 0

    const upload = () => {
        setError(null)
        const files = inputRef.current?.files
        if (!files?.length) return

        const fd = new FormData()
        for (const f of files) fd.append(productGroupField(group.key), f)

        startTransition(async () => {
            const res = await addProductImages(productId, group.key, fd)
            if (!res.ok) setError(res.error)
            else {
                setPicked([])
                if (inputRef.current) inputRef.current.value = ""
                router.refresh()
            }
        })
    }

    const move = (imageId: string, dir: "up" | "down") => {
        setError(null)
        startTransition(async () => {
            const res = await moveProductImage(imageId, dir)
            if (!res.ok) setError(res.error)
            else router.refresh()
        })
    }

    return (
        <div
            className={cn(
                "border rounded-2xl p-4 bg-paper transition-colors",
                group.required && empty ? "border-danger/40" : "border-line"
            )}
        >
            <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-semibold tracking-tight">
                        {group.label}
                        {group.required && <span className="ml-1.5 text-danger">*</span>}
                        {empty && (
                            <span className="ml-2 text-[11px] font-medium text-ink-mute">
                                {group.required ? "ยังไม่มีรูป (บังคับ)" : "ยังไม่มีรูป"}
                            </span>
                        )}
                    </p>
                    <p className="text-[11px] text-ink-mute mt-0.5">
                        {group.hint}
                        {group.suggested > 0 && ` · แนะนำ ${group.suggested} รูป`}
                    </p>
                </div>
                <span className="eyebrow tnum shrink-0">{images.length}</span>
            </div>

            {images.length > 0 && (
                <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    {images.map((img, i) => (
                        <li key={img.id} className="rounded-xl border border-line overflow-hidden">
                            <a href={img.url} target="_blank" rel="noreferrer" className="block bg-paper-2 relative">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img.url} alt={img.caption ?? ""} className="w-full aspect-square object-cover" />
                                {group.key === "FRONT" && i === 0 && (
                                    <Badge tone="ink" className="absolute top-1.5 left-1.5">ปก</Badge>
                                )}
                            </a>
                            <div className="flex items-center justify-between gap-1 px-1.5 py-1">
                                <div className="flex">
                                    <button
                                        type="button" onClick={() => move(img.id, "up")} disabled={pending || i === 0}
                                        aria-label="เลื่อนซ้าย"
                                        className="w-6 h-6 rounded text-ink-mute hover:text-ink disabled:opacity-25 transition-colors"
                                    >←</button>
                                    <button
                                        type="button" onClick={() => move(img.id, "down")} disabled={pending || i === images.length - 1}
                                        aria-label="เลื่อนขวา"
                                        className="w-6 h-6 rounded text-ink-mute hover:text-ink disabled:opacity-25 transition-colors"
                                    >→</button>
                                </div>
                                <ConfirmAction
                                    action={deleteProductImage.bind(null, img.id)}
                                    title="ลบรูปนี้?"
                                    message={`รูปในหมวด "${group.label}" จะถูกนำออกจากหน้าสินค้า`}
                                    confirmLabel="ลบ"
                                    className="eyebrow text-ink-mute hover:text-danger transition-colors px-1"
                                >ลบ</ConfirmAction>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <label
                htmlFor={id}
                className="mt-4 flex items-center justify-center w-full h-10 rounded-xl border border-dashed border-line hover:border-ink-mute cursor-pointer transition-colors text-[13px] font-semibold text-ink-soft"
            >
                {picked.length > 0 ? `เลือกไว้ ${picked.length} รูป · เปลี่ยน` : empty ? "เลือกรูป" : "เพิ่มรูป"}
            </label>
            <input
                ref={inputRef}
                id={id}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(e) => setPicked([...(e.target.files ?? [])].map((f) => URL.createObjectURL(f)))}
            />

            {picked.length > 0 && (
                <>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3">
                        {picked.map((src, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={src} alt="" className="w-full aspect-square object-cover rounded-lg border border-line" />
                        ))}
                    </div>
                    <Button type="button" size="sm" className="mt-3" onClick={upload} disabled={pending}>
                        {pending ? <Spinner /> : `อัปโหลด ${picked.length} รูป`}
                    </Button>
                </>
            )}

            {error && <Notice tone="danger" className="mt-3">{error}</Notice>}
        </div>
    )
}

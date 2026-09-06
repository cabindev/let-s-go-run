'use client'

import { useState, useRef } from "react"
import { productGroupField, type ProductImageGroup } from "@/lib/product-image-groups"
import { cn } from "@/lib/utils"

/**
 * ช่องเลือกรูปของหมวดหนึ่งตอนสร้างสินค้า
 * หมวดที่ `required` จะขึ้นดาวแดงและเปลี่ยนขอบเป็นสีเขียวเมื่อเลือกรูปแล้ว
 */
export function ProductImageGroupInput({
    group,
    onChange,
}: {
    group: ProductImageGroup
    onChange?: (count: number) => void
}) {
    const [previews, setPreviews] = useState<string[]>([])
    const inputRef = useRef<HTMLInputElement>(null)
    const id = `product-group-${group.key}`

    const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = [...(e.target.files ?? [])]
        setPreviews(files.map((f) => URL.createObjectURL(f)))
        onChange?.(files.length)
    }

    const clear = () => {
        setPreviews([])
        if (inputRef.current) inputRef.current.value = ""
        onChange?.(0)
    }

    const filled = previews.length > 0

    return (
        <div
            className={cn(
                "border rounded-2xl p-4 bg-paper transition-colors",
                group.required && !filled ? "border-danger/40" : "border-line"
            )}
        >
            <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-semibold tracking-tight">
                        {group.label}
                        {group.required ? (
                            <span className="ml-1.5 text-danger">*</span>
                        ) : (
                            <span className="ml-2 text-[11px] font-medium text-ink-mute">ไม่บังคับ</span>
                        )}
                    </p>
                    <p className="text-[11px] text-ink-mute mt-0.5">
                        {group.hint}
                        {group.suggested > 0 && ` · แนะนำ ${group.suggested} รูป`}
                    </p>
                </div>

                {filled && (
                    <button
                        type="button"
                        onClick={clear}
                        className="eyebrow text-ink-mute hover:text-danger transition-colors shrink-0"
                    >
                        ล้าง
                    </button>
                )}
            </div>

            <label
                htmlFor={id}
                className="mt-3 flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-dashed border-line hover:border-ink-mute cursor-pointer transition-colors text-[13px] font-semibold text-ink-soft"
            >
                {filled ? `เลือกไว้ ${previews.length} รูป · เปลี่ยน` : "เลือกรูป"}
            </label>
            <input
                ref={inputRef}
                id={id}
                type="file"
                name={productGroupField(group.key)}
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={pick}
            />

            {filled && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3">
                    {previews.map((src, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            key={i}
                            src={src}
                            alt=""
                            className="w-full aspect-square object-cover rounded-lg border border-line"
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

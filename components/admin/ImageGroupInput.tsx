'use client'

import { useState, useRef } from "react"
import type { ImageGroup } from "@/lib/image-groups"
import { groupField } from "@/lib/image-groups"

/**
 * ช่องเลือกรูปของหมวดหนึ่ง — ทุกหมวดไม่บังคับ
 * แสดง "จำนวนที่แนะนำ" เป็นคำใบ้ แต่เลือกกี่รูปก็ได้
 */
export function ImageGroupInput({
    group,
    onChange,
}: {
    group: ImageGroup
    onChange?: (count: number) => void
}) {
    const [previews, setPreviews] = useState<string[]>([])
    const inputRef = useRef<HTMLInputElement>(null)
    const id = `group-${group.key}`

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

    return (
        <div className="border border-line rounded-2xl p-4 bg-paper">
            <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-semibold tracking-tight">
                        {group.label}
                        <span className="ml-2 text-[11px] font-medium text-ink-mute">ไม่บังคับ</span>
                    </p>
                    <p className="text-[11px] text-ink-mute mt-0.5">
                        {group.hint}
                        {group.suggested > 0 && ` · แนะนำ ${group.suggested} รูป`}
                    </p>
                </div>

                {previews.length > 0 && (
                    <button type="button" onClick={clear} className="eyebrow text-ink-mute hover:text-move transition-colors shrink-0">
                        ล้าง
                    </button>
                )}
            </div>

            <label
                htmlFor={id}
                className="mt-3 flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-dashed border-line hover:border-ink-mute cursor-pointer transition-colors text-[13px] font-semibold text-ink-soft"
            >
                {previews.length > 0 ? `เลือกไว้ ${previews.length} รูป · เปลี่ยน` : "เลือกรูป"}
            </label>
            <input
                ref={inputRef}
                id={id}
                type="file"
                name={groupField(group.key)}
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={pick}
            />

            {previews.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3">
                    {previews.map((src, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={src} alt="" className="w-full aspect-square object-cover rounded-lg border border-line" />
                    ))}
                </div>
            )}
        </div>
    )
}

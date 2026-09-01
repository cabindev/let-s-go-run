'use client'

import { useState, useEffect, useCallback } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface Img {
    id: string
    url: string
    caption: string | null
    width?: number | null
    height?: number | null
}

/**
 * แกลเลอรีรูปประกอบ — คลิกเพื่อดูเต็มจอ เลื่อนซ้าย/ขวาด้วยปุ่มหรือคีย์บอร์ด
 *
 * layout "stack" : เรียงบนลงล่าง เต็มความกว้าง คงสัดส่วนจริงของรูป
 * layout "grid"  : ตารางย่อรูปเป็นสี่เหลี่ยมจัตุรัส (ใช้กับรูปจำนวนมาก เช่น บรรยากาศงาน)
 */
export function Gallery({
    images,
    layout = "grid",
}: {
    images: Img[]
    layout?: "stack" | "grid"
}) {
    const [index, setIndex] = useState<number | null>(null)

    const close = useCallback(() => setIndex(null), [])
    const prev = useCallback(() => setIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length)), [images.length])
    const next = useCallback(() => setIndex((i) => (i === null ? null : (i + 1) % images.length)), [images.length])

    useEffect(() => {
        if (index === null) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") close()
            if (e.key === "ArrowLeft") prev()
            if (e.key === "ArrowRight") next()
        }
        document.addEventListener("keydown", onKey)
        document.body.style.overflow = "hidden"
        return () => {
            document.removeEventListener("keydown", onKey)
            document.body.style.overflow = ""
        }
    }, [index, close, prev, next])

    if (images.length === 0) return null

    const isStack = layout === "stack"

    return (
        <>
            <ul className={cn(isStack ? "space-y-4" : "grid grid-cols-2 sm:grid-cols-3 gap-3")}>
                {images.map((img, i) => (
                    <li key={img.id}>
                        <button
                            type="button"
                            onClick={() => setIndex(i)}
                            aria-label={img.caption || `ดูรูปที่ ${i + 1}`}
                            className={cn(
                                "block w-full overflow-hidden bg-paper-3 border border-line transition-colors",
                                isStack ? "rounded-3xl hover:border-ink-mute" : "rounded-2xl hover:border-ink-mute"
                            )}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={img.url}
                                alt={img.caption ?? ""}
                                loading="lazy"
                                // ใส่ขนาดจริงเพื่อให้เบราว์เซอร์จองพื้นที่ไว้ก่อน หน้าจะได้ไม่กระโดด
                                width={img.width ?? undefined}
                                height={img.height ?? undefined}
                                className={cn("w-full", isStack ? "h-auto" : "aspect-square object-cover")}
                            />
                        </button>
                    </li>
                ))}
            </ul>

            {index !== null && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="ดูรูปขนาดเต็ม"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 backdrop-blur-sm p-4"
                    onClick={close}
                >
                    <button
                        type="button"
                        onClick={close}
                        aria-label="ปิด"
                        className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {images.length > 1 && (
                        <>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); prev() }}
                                aria-label="รูปก่อนหน้า"
                                className="absolute left-3 sm:left-6 w-11 h-11 rounded-full bg-white/10 text-white text-xl flex items-center justify-center hover:bg-white/20 transition-colors"
                            >
                                ←
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); next() }}
                                aria-label="รูปถัดไป"
                                className="absolute right-3 sm:right-6 w-11 h-11 rounded-full bg-white/10 text-white text-xl flex items-center justify-center hover:bg-white/20 transition-colors"
                            >
                                →
                            </button>
                        </>
                    )}

                    <figure onClick={(e) => e.stopPropagation()} className="max-w-4xl w-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={images[index].url}
                            alt={images[index].caption ?? ""}
                            className="w-full max-h-[80vh] object-contain rounded-2xl"
                        />
                        <figcaption className="text-center text-white/70 text-[14px] mt-3 tnum">
                            {images[index].caption || `${index + 1} / ${images.length}`}
                        </figcaption>
                    </figure>
                </div>
            )}
        </>
    )
}

'use client'

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight, X, Expand } from "lucide-react"
import type { ProductImageCategory } from "@prisma/client"
import { PRODUCT_GROUP_LABEL } from "@/lib/product-image-groups"
import { cn } from "@/lib/utils"

export interface GalleryImage {
    id: string
    url: string
    caption: string | null
    category: ProductImageCategory
}

/**
 * แกลเลอรีสินค้าแบบร้านค้าทั่วไป — รูปใหญ่ + แถบรูปย่อ กดแล้วเปิดดูเต็มจอ
 *
 * ในโหมดเต็มจอเลื่อนดูได้ด้วยปุ่มลูกศร คีย์บอร์ด และปัดนิ้วบนมือถือ
 * ปิดด้วยปุ่ม X, กด Esc หรือแตะพื้นหลัง
 */
export function ProductGalleryViewer({
    images,
    productName,
}: {
    images: GalleryImage[]
    productName: string
}) {
    const [index, setIndex] = useState(0)
    const [zoomed, setZoomed] = useState(false)
    const touchStartX = useRef<number | null>(null)

    const count = images.length
    const current = images[index]

    const go = useCallback(
        (delta: number) => setIndex((i) => (count === 0 ? 0 : (i + delta + count) % count)),
        [count]
    )

    // คีย์บอร์ดใช้ได้เฉพาะตอนเปิดเต็มจอ — ไม่งั้นจะไปแย่งลูกศรของหน้าเว็บปกติ
    useEffect(() => {
        if (!zoomed) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setZoomed(false)
            else if (e.key === "ArrowRight") go(1)
            else if (e.key === "ArrowLeft") go(-1)
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [zoomed, go])

    // ล็อกไม่ให้หน้าด้านหลังเลื่อนตามขณะเปิดเต็มจอ
    useEffect(() => {
        if (!zoomed) return
        const previous = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => {
            document.body.style.overflow = previous
        }
    }, [zoomed])

    if (count === 0) {
        return (
            <div className="aspect-square rounded-3xl bg-paper-2 border border-line flex items-center justify-center">
                <span className="eyebrow">ไม่มีรูป</span>
            </div>
        )
    }

    const onTouchEnd = (e: React.TouchEvent) => {
        const start = touchStartX.current
        touchStartX.current = null
        if (start === null) return
        const delta = e.changedTouches[0].clientX - start
        if (Math.abs(delta) > 50) go(delta < 0 ? 1 : -1)
    }

    return (
        <div className="space-y-3">
            {/* รูปใหญ่ */}
            <div className="relative group">
                <button
                    type="button"
                    onClick={() => setZoomed(true)}
                    className="block w-full aspect-square rounded-3xl bg-paper-2 border border-line overflow-hidden cursor-zoom-in"
                    aria-label={`ดูรูปเต็มจอ — ${PRODUCT_GROUP_LABEL[current.category]}`}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={current.url}
                        alt={current.caption ?? `${productName} — ${PRODUCT_GROUP_LABEL[current.category]}`}
                        className="w-full h-full object-cover"
                    />
                </button>

                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-ink/75 backdrop-blur text-white text-[11px] font-bold uppercase tracking-[0.08em] pointer-events-none">
                    {PRODUCT_GROUP_LABEL[current.category]}
                </span>

                <span className="absolute top-3 right-3 w-8 h-8 rounded-full bg-ink/75 backdrop-blur text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <Expand className="w-4 h-4" strokeWidth={2} />
                </span>

                {count > 1 && (
                    <>
                        <ArrowButton side="left" onClick={() => go(-1)} label="รูปก่อนหน้า" />
                        <ArrowButton side="right" onClick={() => go(1)} label="รูปถัดไป" />
                        <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-ink/75 backdrop-blur text-white text-[11px] font-semibold tnum pointer-events-none">
                            {index + 1} / {count}
                        </span>
                    </>
                )}
            </div>

            {/* แถบรูปย่อ */}
            {count > 1 && (
                <div className="grid grid-cols-5 gap-2">
                    {images.map((img, i) => (
                        <button
                            key={img.id}
                            type="button"
                            onClick={() => setIndex(i)}
                            aria-label={PRODUCT_GROUP_LABEL[img.category]}
                            aria-current={i === index ? "true" : undefined}
                            className={cn(
                                "aspect-square rounded-xl overflow-hidden bg-paper-2 border transition-colors",
                                i === index ? "border-ink ring-1 ring-ink" : "border-line hover:border-ink-mute"
                            )}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.url} alt="" className="w-full h-full object-cover" />
                        </button>
                    ))}
                </div>
            )}

            {/*
                เต็มจอ — ต้อง render ผ่าน portal ไปที่ body เพราะกล่องรูปอยู่ใน element ที่เป็น
                position:sticky ซึ่งสร้าง stacking context ของตัวเอง ทำให้ z-index ของ overlay
                ถูกกักอยู่ข้างใน แล้วแถบบนของหน้า (z-30) ทะลุขึ้นมาทับรูปได้
                portal ทำงานเฉพาะฝั่ง client แต่ตอน SSR/hydrate ค่า zoomed เป็น false อยู่แล้ว
            */}
            {zoomed && createPortal(
                <div
                    className="fixed inset-0 z-[100] flex flex-col bg-ink/95 backdrop-blur-sm animate-rise"
                    role="dialog"
                    aria-modal="true"
                    aria-label={`รูปสินค้า ${productName}`}
                    onClick={() => setZoomed(false)}
                >
                    <div className="flex items-center justify-between gap-4 px-5 py-4 text-white shrink-0">
                        <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/60">
                                {PRODUCT_GROUP_LABEL[current.category]}
                            </p>
                            <p className="text-sm font-semibold truncate">{productName}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[13px] font-semibold tnum text-white/70">
                                {index + 1} / {count}
                            </span>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setZoomed(false) }}
                                aria-label="ปิด"
                                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                            >
                                <X className="w-5 h-5" strokeWidth={2} />
                            </button>
                        </div>
                    </div>

                    <div
                        className="flex-1 min-h-0 flex items-center justify-center px-4 pb-4 relative"
                        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX }}
                        onTouchEnd={onTouchEnd}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={current.url}
                            alt={current.caption ?? `${productName} — ${PRODUCT_GROUP_LABEL[current.category]}`}
                            className="max-h-full max-w-full object-contain rounded-xl"
                            onClick={(e) => e.stopPropagation()}
                        />

                        {count > 1 && (
                            <>
                                <FullArrow side="left" onClick={() => go(-1)} label="รูปก่อนหน้า" />
                                <FullArrow side="right" onClick={() => go(1)} label="รูปถัดไป" />
                            </>
                        )}
                    </div>

                    {count > 1 && (
                        <div
                            className="shrink-0 flex gap-2 justify-center px-5 pb-5 overflow-x-auto no-scrollbar"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {images.map((img, i) => (
                                <button
                                    key={img.id}
                                    type="button"
                                    onClick={() => setIndex(i)}
                                    aria-label={PRODUCT_GROUP_LABEL[img.category]}
                                    className={cn(
                                        "w-14 h-14 shrink-0 rounded-lg overflow-hidden border-2 transition-colors",
                                        i === index ? "border-white" : "border-transparent opacity-50 hover:opacity-100"
                                    )}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div>
    )
}

function ArrowButton({ side, onClick, label }: { side: "left" | "right"; onClick: () => void; label: string }) {
    const Icon = side === "left" ? ChevronLeft : ChevronRight
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className={cn(
                "absolute top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-paper/90 border border-line",
                "flex items-center justify-center text-ink shadow-sm",
                "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-paper",
                side === "left" ? "left-3" : "right-3"
            )}
        >
            <Icon className="w-5 h-5" strokeWidth={2.2} />
        </button>
    )
}

function FullArrow({ side, onClick, label }: { side: "left" | "right"; onClick: () => void; label: string }) {
    const Icon = side === "left" ? ChevronLeft : ChevronRight
    return (
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClick() }}
            aria-label={label}
            className={cn(
                "absolute top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20",
                "flex items-center justify-center text-white transition-colors",
                side === "left" ? "left-2 sm:left-6" : "right-2 sm:right-6"
            )}
        >
            <Icon className="w-6 h-6" strokeWidth={2.2} />
        </button>
    )
}

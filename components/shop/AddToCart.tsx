'use client'

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { addToCart } from "@/app/actions/cart"
import { Button, Spinner } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"
import { stockLabel } from "@/lib/shop"
import { cn, formatPrice } from "@/lib/utils"

export interface VariantOption {
    id: string
    name: string
    price: number
    stock: number | null
    maxQty: number
}

export function AddToCart({
    variants,
    maxPerOrder,
    isLoggedIn,
}: {
    variants: VariantOption[]
    maxPerOrder: number
    isLoggedIn: boolean
}) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [done, setDone] = useState(false)

    const firstAvailable = variants.find((v) => v.maxQty > 0)
    const [variantId, setVariantId] = useState<string | null>(firstAvailable?.id ?? null)
    const [qty, setQty] = useState(1)

    const selected = variants.find((v) => v.id === variantId) ?? null
    const max = selected ? Math.min(selected.maxQty, maxPerOrder) : 0

    const pick = (v: VariantOption) => {
        if (v.maxQty <= 0) return
        setVariantId(v.id)
        setQty((q) => Math.min(q, Math.min(v.maxQty, maxPerOrder)) || 1)
        setError(null)
        setDone(false)
    }

    const submit = () => {
        if (!selected) return
        setError(null)
        setDone(false)
        startTransition(async () => {
            const res = await addToCart(selected.id, qty)
            if (!res.ok) {
                setError(res.error)
                return
            }
            setDone(true)
            router.refresh()
        })
    }

    if (!isLoggedIn) {
        return (
            <div className="space-y-4">
                <Notice tone="sky" title="เข้าสู่ระบบก่อนสั่งซื้อ">
                    <p>ต้องเข้าสู่ระบบเพื่อใส่สินค้าลงตะกร้า — ใช้บัญชีเดียวกับที่สมัครงานวิ่งได้เลย</p>
                </Notice>
                <Button
                    type="button"
                    size="lg"
                    className="w-full"
                    onClick={() => router.push(`/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname)}`)}
                >
                    เข้าสู่ระบบ
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            <div>
                <p className="eyebrow mb-3">เลือกตัวเลือก</p>
                <div className="space-y-2">
                    {variants.map((v) => {
                        const stock = stockLabel(v.stock)
                        const disabled = v.maxQty <= 0
                        const active = v.id === variantId

                        return (
                            <button
                                key={v.id}
                                type="button"
                                onClick={() => pick(v)}
                                disabled={disabled}
                                aria-pressed={active}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-colors",
                                    disabled
                                        ? "border-line bg-paper-2 opacity-60 cursor-not-allowed"
                                        : active
                                            ? "border-ink bg-paper ring-1 ring-ink"
                                            : "border-line bg-paper hover:border-ink-mute"
                                )}
                            >
                                <span
                                    className={cn(
                                        "w-4 h-4 rounded-full border shrink-0",
                                        active ? "border-[5px] border-ink" : "border-line"
                                    )}
                                    aria-hidden
                                />
                                <span className="min-w-0 flex-1">
                                    <span
                                        className={cn(
                                            "block text-sm font-semibold tracking-tight truncate",
                                            disabled && "line-through"
                                        )}
                                    >
                                        {v.name}
                                    </span>
                                    <span
                                        className={cn(
                                            "block text-[11px] mt-0.5 tnum",
                                            stock.tone === "danger" ? "text-danger" : "text-ink-mute"
                                        )}
                                    >
                                        {stock.label}
                                    </span>
                                </span>
                                <span className="numeral text-base shrink-0">{formatPrice(v.price)}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {selected && max > 0 && (
                <div className="flex items-center justify-between gap-4">
                    <span className="eyebrow">จำนวน</span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setQty((q) => Math.max(1, q - 1))}
                            disabled={qty <= 1 || pending}
                            aria-label="ลดจำนวน"
                            className="w-10 h-10 rounded-full border border-line hover:border-ink-mute disabled:opacity-30 transition-colors"
                        >
                            −
                        </button>
                        <span className="numeral text-lg w-10 text-center">{qty}</span>
                        <button
                            type="button"
                            onClick={() => setQty((q) => Math.min(max, q + 1))}
                            disabled={qty >= max || pending}
                            aria-label="เพิ่มจำนวน"
                            className="w-10 h-10 rounded-full border border-line hover:border-ink-mute disabled:opacity-30 transition-colors"
                        >
                            +
                        </button>
                    </div>
                </div>
            )}

            {selected && max > 0 && qty >= max && (
                <p className="text-[12px] text-ink-mute text-right">สั่งได้สูงสุด {max} ชิ้น</p>
            )}

            {error && <Notice tone="danger">{error}</Notice>}

            {done && (
                <Notice tone="lime" title="ใส่ตะกร้าแล้ว">
                    <button
                        type="button"
                        onClick={() => router.push("/cart")}
                        className="eyebrow text-ink hover:text-ink-soft transition-colors"
                    >
                        ไปที่ตะกร้า →
                    </button>
                </Notice>
            )}

            <Button
                type="button"
                size="lg"
                className="w-full"
                onClick={submit}
                disabled={pending || !selected || max <= 0}
            >
                {pending ? <Spinner /> : max <= 0 ? "สินค้าหมด" : "ใส่ตะกร้า"}
            </Button>
        </div>
    )
}

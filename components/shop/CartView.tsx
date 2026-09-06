'use client'

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { removeCartItem, updateCartItem } from "@/app/actions/cart"
import { Badge, Notice } from "@/components/ui/Badge"
import { ButtonLink, Spinner } from "@/components/ui/Button"
import { PRODUCT_TYPE_LABEL, PRODUCT_TYPE_TONE } from "@/lib/shop"
import type { CartLine } from "@/lib/cart"
import { formatBaht, formatPrice } from "@/lib/utils"

export interface CartGroupView {
    type: "STOCK" | "PREORDER"
    lines: CartLine[]
    quantity: number
    subtotal: number
}

export function CartView({
    groups,
    hasIssue,
    shippingHint,
}: {
    groups: CartGroupView[]
    hasIssue: boolean
    shippingHint: string
}) {
    const total = groups.reduce((s, g) => s + g.subtotal, 0)
    const totalQty = groups.reduce((s, g) => s + g.quantity, 0)
    const splits = groups.length > 1

    return (
        <div className="space-y-8">
            {splits && (
                <Notice tone="sky" title="ตะกร้านี้จะถูกแยกเป็น 2 ออเดอร์">
                    <p>
                        สินค้าพร้อมส่งกับพรีออเดอร์มีรอบจัดส่งต่างกัน ระบบจึงแยกเป็นคนละออเดอร์
                        แต่ละใบมีค่าจัดส่งและเลขพัสดุของตัวเอง
                    </p>
                </Notice>
            )}

            {groups.map((group) => (
                <section key={group.type} className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Badge tone={PRODUCT_TYPE_TONE[group.type]}>{PRODUCT_TYPE_LABEL[group.type]}</Badge>
                            <span className="eyebrow tnum">{group.quantity} ชิ้น</span>
                        </div>
                        <span className="numeral text-base">{formatBaht(group.subtotal)}</span>
                    </div>

                    <ul className="divide-y divide-line border-y border-line">
                        {group.lines.map((line) => (
                            <CartRow key={line.itemId} line={line} />
                        ))}
                    </ul>
                </section>
            ))}

            <div className="rounded-2xl bg-paper border border-line p-5 space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                    <span className="eyebrow">ยอดสินค้ารวม · {totalQty} ชิ้น</span>
                    <span className="numeral text-2xl">{formatBaht(total)}</span>
                </div>
                <p className="text-[12px] text-ink-mute tnum">{shippingHint}</p>
            </div>

            {hasIssue ? (
                <Notice tone="danger" title="มีรายการที่สั่งซื้อไม่ได้">
                    <p>กรุณาแก้จำนวนหรือลบรายการที่มีปัญหาออกก่อน จึงจะไปขั้นตอนชำระเงินได้</p>
                </Notice>
            ) : (
                <ButtonLink href="/checkout" size="lg" className="w-full">
                    ดำเนินการสั่งซื้อ
                </ButtonLink>
            )}

            <Link href="/shop" className="block text-center eyebrow text-ink-mute hover:text-ink transition-colors">
                เลือกสินค้าเพิ่ม
            </Link>
        </div>
    )
}

function CartRow({ line }: { line: CartLine }) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    const change = (qty: number) => {
        setError(null)
        startTransition(async () => {
            const res = await updateCartItem(line.itemId, qty)
            if (!res.ok) setError(res.error)
            else router.refresh()
        })
    }

    const remove = () => {
        setError(null)
        startTransition(async () => {
            const res = await removeCartItem(line.itemId)
            if (!res.ok) setError(res.error)
            else router.refresh()
        })
    }

    return (
        <li className="py-4">
            <div className="flex items-start gap-4">
                <Link href={`/shop/${line.slug}`} className="shrink-0">
                    {line.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={line.imageUrl}
                            alt=""
                            className="w-16 h-16 rounded-xl object-cover border border-line"
                        />
                    ) : (
                        <div className="w-16 h-16 rounded-xl bg-paper-2 border border-line" />
                    )}
                </Link>

                <div className="min-w-0 flex-1">
                    <Link
                        href={`/shop/${line.slug}`}
                        className="text-sm font-semibold tracking-tight hover:text-ink-soft transition-colors line-clamp-2"
                    >
                        {line.productName}
                    </Link>
                    <p className="text-[12px] text-ink-mute mt-0.5">{line.variantName}</p>
                    <p className="text-[12px] text-ink-mute tnum mt-0.5">{formatPrice(line.unitPrice)} / ชิ้น</p>

                    <div className="flex items-center gap-2 mt-3">
                        <button
                            type="button"
                            onClick={() => change(line.quantity - 1)}
                            disabled={pending || line.quantity <= 1}
                            aria-label="ลดจำนวน"
                            className="w-8 h-8 rounded-full border border-line hover:border-ink-mute disabled:opacity-30 transition-colors text-sm"
                        >
                            −
                        </button>
                        <span className="numeral text-sm w-8 text-center">
                            {pending ? <Spinner /> : line.quantity}
                        </span>
                        <button
                            type="button"
                            onClick={() => change(line.quantity + 1)}
                            disabled={pending || line.quantity >= line.maxQty}
                            aria-label="เพิ่มจำนวน"
                            className="w-8 h-8 rounded-full border border-line hover:border-ink-mute disabled:opacity-30 transition-colors text-sm"
                        >
                            +
                        </button>
                        <button
                            type="button"
                            onClick={remove}
                            disabled={pending}
                            className="eyebrow text-ink-mute hover:text-danger transition-colors ml-3"
                        >
                            ลบ
                        </button>
                    </div>
                </div>

                <span className="numeral text-base shrink-0">{formatBaht(line.lineTotal)}</span>
            </div>

            {line.issue && (
                <Notice tone="danger" className="mt-3">
                    {line.issue}
                </Notice>
            )}
            {error && (
                <Notice tone="danger" className="mt-3">
                    {error}
                </Notice>
            )}
        </li>
    )
}

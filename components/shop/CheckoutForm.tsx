'use client'

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { ShopDelivery } from "@prisma/client"
import { placeOrder } from "@/app/actions/order"
import { Button, Spinner } from "@/components/ui/Button"
import { Badge, Notice } from "@/components/ui/Badge"
import { Field, TextArea, Select, inputClass } from "@/components/ui/Field"
import { DELIVERY_LABEL, PRODUCT_TYPE_LABEL, PRODUCT_TYPE_TONE, shippingFee } from "@/lib/shop"
import { PROVINCES } from "@/lib/events"
import type { CartLine } from "@/lib/cart"
import { cn, formatBaht } from "@/lib/utils"

export interface CheckoutGroup {
    type: "STOCK" | "PREORDER"
    lines: CartLine[]
    quantity: number
    subtotal: number
}

export function CheckoutForm({
    groups,
    allowPickup,
    allowShipping,
    shippingBaseFee,
    shippingExtraPerItem,
    pickupLocation,
    defaults,
}: {
    groups: CheckoutGroup[]
    allowPickup: boolean
    allowShipping: boolean
    shippingBaseFee: number
    shippingExtraPerItem: number
    pickupLocation: string | null
    defaults: { name: string; phone: string }
}) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    const [delivery, setDelivery] = useState<ShopDelivery>(allowPickup ? "PICKUP" : "SHIPPING")

    // ค่าส่งคิดแยกต่อออเดอร์ เพราะสินค้าพร้อมส่งกับพรีออเดอร์ถูกแยกเป็นคนละใบ
    const setting = { shippingBaseFee, shippingExtraPerItem }
    const priced = groups.map((g) => {
        const fee = delivery === "SHIPPING" ? shippingFee(g.quantity, setting) : 0
        return { ...g, shippingFee: fee, total: g.subtotal + fee }
    })

    const subtotal = priced.reduce((s, g) => s + g.subtotal, 0)
    const totalShipping = priced.reduce((s, g) => s + g.shippingFee, 0)
    const grandTotal = priced.reduce((s, g) => s + g.total, 0)

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        const formData = new FormData(e.currentTarget)
        startTransition(async () => {
            const res = await placeOrder(formData)
            if (!res.ok) {
                setError(res.error)
                return
            }
            // สั่งได้หลายใบพร้อมกัน — ใบเดียวไปหน้าจ่ายเลย หลายใบไปหน้ารวมออเดอร์
            router.push(res.orderIds.length === 1 ? `/orders/${res.orderIds[0]}` : "/orders")
            router.refresh()
        })
    }

    return (
        <form onSubmit={onSubmit} className="space-y-10">
            <input type="hidden" name="deliveryMethod" value={delivery} />
            {/* ยอดที่ผู้ซื้อเห็นบนจอ — ฝั่ง server ใช้เทียบยืนยันเท่านั้น ไม่ได้เอาไปคิดเงิน */}
            <input type="hidden" name="expectedTotal" value={grandTotal} />

            <section className="space-y-3">
                <p className="eyebrow">วิธีรับของ</p>

                {!allowPickup && (
                    <Notice tone="neutral">มีสินค้าในตะกร้าที่ต้องจัดส่งทางไปรษณีย์เท่านั้น</Notice>
                )}
                {!allowShipping && (
                    <Notice tone="neutral">มีสินค้าในตะกร้าที่ต้องมารับด้วยตนเองเท่านั้น</Notice>
                )}

                <div className="space-y-2">
                    <DeliveryOption
                        active={delivery === "PICKUP"}
                        disabled={!allowPickup}
                        onClick={() => setDelivery("PICKUP")}
                        title={DELIVERY_LABEL.PICKUP}
                        desc={pickupLocation || "มารับที่จุดนัดหมายของผู้จัด"}
                        price="ไม่มีค่าใช้จ่าย"
                    />
                    <DeliveryOption
                        active={delivery === "SHIPPING"}
                        disabled={!allowShipping}
                        onClick={() => setDelivery("SHIPPING")}
                        title={DELIVERY_LABEL.SHIPPING}
                        desc={`ชิ้นแรก ${formatBaht(shippingBaseFee)} ชิ้นถัดไปบวกชิ้นละ ${formatBaht(shippingExtraPerItem)}`}
                        price={delivery === "SHIPPING" ? formatBaht(totalShipping) : "คำนวณตามจำนวนชิ้น"}
                    />
                </div>
            </section>

            {delivery === "SHIPPING" ? (
                <section className="space-y-7">
                    <p className="eyebrow">ที่อยู่จัดส่ง</p>
                    <div className="grid sm:grid-cols-2 gap-7">
                        <Field label="ชื่อผู้รับ" name="recipientName" required maxLength={120} defaultValue={defaults.name} />
                        <Field
                            label="เบอร์โทรผู้รับ" name="recipientPhone" required maxLength={20}
                            defaultValue={defaults.phone} placeholder="08x-xxx-xxxx"
                        />
                    </div>
                    <TextArea
                        label="ที่อยู่" name="address" rows={3} required maxLength={400}
                        placeholder="บ้านเลขที่ หมู่ ถนน ตำบล/แขวง อำเภอ/เขต"
                    />
                    <div className="grid sm:grid-cols-2 gap-7">
                        <Select label="จังหวัด" name="province" required defaultValue="">
                            <option value="" disabled>เลือกจังหวัด</option>
                            {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                        </Select>
                        <Field
                            label="รหัสไปรษณีย์" name="postalCode" required
                            inputMode="numeric" pattern="\d{5}" maxLength={5} placeholder="50120"
                        />
                    </div>
                </section>
            ) : (
                <section className="space-y-7">
                    <p className="eyebrow">ข้อมูลผู้รับ</p>
                    <div className="grid sm:grid-cols-2 gap-7">
                        <Field label="ชื่อผู้รับ" name="recipientName" maxLength={120} defaultValue={defaults.name} />
                        <Field
                            label="เบอร์โทรติดต่อ" name="recipientPhone" maxLength={20}
                            defaultValue={defaults.phone} placeholder="08x-xxx-xxxx"
                        />
                    </div>
                </section>
            )}

            <section className="space-y-3">
                <p className="eyebrow">หมายเหตุถึงผู้ขาย</p>
                <textarea
                    name="customerNote"
                    rows={2}
                    maxLength={400}
                    placeholder="ไม่บังคับ — เช่น ขอให้ห่อแยก หรือเวลาที่สะดวกรับของ"
                    className={cn(inputClass, "resize-y")}
                />
            </section>

            {/* สรุปยอด */}
            <section className="space-y-4">
                <p className="eyebrow">สรุปคำสั่งซื้อ</p>

                {priced.length > 1 && (
                    <Notice tone="sky" title="จะถูกแยกเป็น 2 ออเดอร์">
                        <p>สินค้าพร้อมส่งกับพรีออเดอร์มีรอบจัดส่งต่างกัน แต่ละใบคิดค่าจัดส่งของตัวเอง</p>
                    </Notice>
                )}

                {priced.map((g) => (
                    <div key={g.type} className="rounded-2xl bg-paper border border-line p-5 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <Badge tone={PRODUCT_TYPE_TONE[g.type]}>{PRODUCT_TYPE_LABEL[g.type]}</Badge>
                            <span className="eyebrow tnum">{g.quantity} ชิ้น</span>
                        </div>

                        <ul className="text-[13px] text-ink-soft space-y-1">
                            {g.lines.map((l) => (
                                <li key={l.itemId} className="flex justify-between gap-3 tnum">
                                    <span className="min-w-0 truncate">
                                        {l.productName} · {l.variantName} ×{l.quantity}
                                    </span>
                                    <span className="shrink-0">{formatBaht(l.lineTotal)}</span>
                                </li>
                            ))}
                        </ul>

                        <dl className="text-[13px] space-y-1 pt-3 border-t border-line tnum">
                            <div className="flex justify-between">
                                <dt className="text-ink-mute">ยอดสินค้า</dt>
                                <dd>{formatBaht(g.subtotal)}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-ink-mute">ค่าจัดส่ง</dt>
                                <dd>{formatBaht(g.shippingFee)}</dd>
                            </div>
                            <div className="flex justify-between font-semibold pt-1">
                                <dt>รวมออเดอร์นี้</dt>
                                <dd className="numeral">{formatBaht(g.total)}</dd>
                            </div>
                        </dl>
                    </div>
                ))}

                <div className="rounded-2xl bg-paper border border-line p-5 space-y-2 tnum">
                    <div className="flex justify-between text-sm">
                        <span className="text-ink-mute">ยอดสินค้ารวม</span>
                        <span>{formatBaht(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-ink-mute">ค่าจัดส่งรวม</span>
                        <span>{formatBaht(totalShipping)}</span>
                    </div>
                    <div className="flex items-baseline justify-between pt-3 border-t border-line">
                        <span className="eyebrow">ยอดที่ต้องชำระ</span>
                        <span className="numeral text-2xl">{formatBaht(grandTotal)}</span>
                    </div>
                    <p className="text-[12px] text-ink-mute">
                        ยังไม่รวมค่าธรรมเนียมการชำระเงิน — เลือกวิธีจ่ายในขั้นถัดไปแล้วจะเห็นยอดสุดท้าย
                    </p>
                </div>
            </section>

            <section className="space-y-3">
                <label className="flex items-start gap-3 text-[13px] text-ink-soft leading-relaxed">
                    <input type="checkbox" name="pdpaConsent" value="1" required className="mt-1 shrink-0" />
                    <span>
                        ข้าพเจ้ายินยอมให้เก็บและใช้ชื่อ เบอร์โทร และที่อยู่ เพื่อจัดส่งสินค้าและติดต่อเรื่องคำสั่งซื้อนี้เท่านั้น
                        ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
                    </span>
                </label>
            </section>

            {error && <Notice tone="danger">{error}</Notice>}

            <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {pending ? <Spinner /> : `ยืนยันคำสั่งซื้อ · ${formatBaht(grandTotal)}`}
            </Button>
        </form>
    )
}

function DeliveryOption({
    active,
    disabled,
    onClick,
    title,
    desc,
    price,
}: {
    active: boolean
    disabled: boolean
    onClick: () => void
    title: string
    desc: string
    price: string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-pressed={active}
            className={cn(
                "w-full flex items-start gap-3 px-4 py-4 rounded-2xl border text-left transition-colors",
                disabled
                    ? "border-line bg-paper-2 opacity-50 cursor-not-allowed"
                    : active
                        ? "border-ink bg-paper ring-1 ring-ink"
                        : "border-line bg-paper hover:border-ink-mute"
            )}
        >
            <span
                className={cn(
                    "w-4 h-4 rounded-full border shrink-0 mt-0.5",
                    active && !disabled ? "border-[5px] border-ink" : "border-line"
                )}
                aria-hidden
            />
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold tracking-tight">{title}</span>
                <span className="block text-[12px] text-ink-mute mt-0.5 leading-relaxed">{desc}</span>
            </span>
            <span className="text-[12px] text-ink-soft tnum shrink-0 text-right">{price}</span>
        </button>
    )
}

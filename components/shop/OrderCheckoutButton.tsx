'use client'

import { useState, useTransition } from "react"
import { createOrderCheckoutSession } from "@/app/actions/order"
import { Spinner } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"
import { amountWithFee, feeOnly, FEE_LABEL, type PaymentMethodChoice } from "@/lib/checkout-fees"
import { cn, formatBaht } from "@/lib/utils"

const METHODS: PaymentMethodChoice[] = ["promptpay", "card"]

/** ปุ่มเลือกวิธีจ่ายของออเดอร์ร้านค้า — ล้อ CheckoutButton ของฝั่งสมัครวิ่ง */
export function OrderCheckoutButton({ orderId, amount }: { orderId: string; amount: number }) {
    const [pending, startTransition] = useTransition()
    const [loadingMethod, setLoadingMethod] = useState<PaymentMethodChoice | null>(null)
    const [error, setError] = useState<string | null>(null)

    const pay = (method: PaymentMethodChoice) => {
        setError(null)
        setLoadingMethod(method)
        startTransition(async () => {
            // สำเร็จแล้ว action จะ redirect ไป Stripe เอง — เข้ามาถึง res แปลว่าล้มเหลว
            const res = await createOrderCheckoutSession(orderId, method)
            if (res && !res.ok) {
                setError(res.error)
                setLoadingMethod(null)
            }
        })
    }

    return (
        <div className="space-y-4">
            <div className="rounded-2xl bg-paper border border-line px-5 py-4 flex items-baseline justify-between gap-3">
                <span className="eyebrow text-ink-mute">ยอดออเดอร์</span>
                <span className="numeral text-2xl">{formatBaht(amount)}</span>
            </div>
            <p className="text-[13px] text-ink-mute">
                เลือกวิธีจ่าย — ยอดด้านล่างรวมค่าธรรมเนียมของแต่ละวิธีแล้ว ต่างกันตามวิธีจ่าย ทางร้านได้รับเต็ม {formatBaht(amount)}
            </p>

            {METHODS.map((method) => {
                const total = amountWithFee(amount, method)
                const fee = feeOnly(amount, method)
                const isLoading = pending && loadingMethod === method

                return (
                    <button
                        key={method}
                        type="button"
                        disabled={pending}
                        onClick={() => pay(method)}
                        className={cn(
                            "w-full flex items-center justify-between gap-3 h-16 px-5 rounded-full border border-line bg-paper",
                            "hover:border-ink-mute transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                    >
                        <span className="text-sm font-semibold tracking-tight">
                            {isLoading ? <Spinner /> : FEE_LABEL[method]}
                        </span>
                        <span className="text-right">
                            <span className="numeral text-base block">{formatBaht(total)}</span>
                            <span className="text-[13px] text-ink-mute">รวมค่าธรรมเนียม {formatBaht(fee)}</span>
                        </span>
                    </button>
                )
            })}

            {error && <Notice tone="danger">{error}</Notice>}
        </div>
    )
}

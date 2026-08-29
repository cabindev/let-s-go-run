'use client'

import { useState, useTransition } from "react"
import { createCheckoutSession } from "@/app/actions/checkout"
import { Spinner } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"
import { amountWithFee, feeOnly, FEE_LABEL, type PaymentMethodChoice } from "@/lib/checkout-fees"
import { formatPrice } from "@/lib/utils"
import { cn } from "@/lib/utils"

const METHODS: PaymentMethodChoice[] = ["promptpay", "card"]

export function CheckoutButton({ registrationId, amount }: { registrationId: string; amount: number }) {
    const [pending, startTransition] = useTransition()
    const [loadingMethod, setLoadingMethod] = useState<PaymentMethodChoice | null>(null)
    const [error, setError] = useState<string | null>(null)

    const pay = (method: PaymentMethodChoice) => {
        setError(null)
        setLoadingMethod(method)
        startTransition(async () => {
            // สำเร็จแล้ว action จะ redirect ไป Stripe เอง — เข้ามาถึง res แปลว่าล้มเหลว
            const res = await createCheckoutSession(registrationId, method)
            if (res && !res.ok) {
                setError(res.error)
                setLoadingMethod(null)
            }
        })
    }

    return (
        <div className="space-y-3">
            <p className="text-[11px] text-ink-mute">
                ยอดรวมค่าธรรมเนียมการชำระเงินแล้ว ต่างกันตามวิธีจ่าย — ผู้จัดงานได้รับเต็ม {formatPrice(amount)}
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
                            <span className="numeral text-base block">{formatPrice(total)}</span>
                            <span className="text-[11px] text-ink-mute">รวมค่าธรรมเนียม {formatPrice(fee)}</span>
                        </span>
                    </button>
                )
            })}

            {error && <Notice tone="move">{error}</Notice>}
        </div>
    )
}

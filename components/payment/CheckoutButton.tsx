'use client'

import { useState, useTransition } from "react"
import { createCheckoutSession } from "@/app/actions/checkout"
import { Notice } from "@/components/ui/Badge"
import { PaymentMethodButton } from "./PaymentMethodButton"
import { amountWithFee, feeOnly, type PaymentMethodChoice } from "@/lib/checkout-fees"
import { formatPrice } from "@/lib/utils"

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
        <div className="space-y-4">
            <div className="rounded-2xl bg-paper border border-line px-5 py-4 flex items-baseline justify-between gap-3">
                <span className="eyebrow text-ink-mute">Total Amount / ยอดที่ต้องชำระ</span>
                <span className="numeral text-2xl">{formatPrice(amount)}</span>
            </div>
            <p className="text-[13px] text-ink-mute">
                Choose a payment method — the amount below already includes each method&apos;s fee, the organizer receives the full {formatPrice(amount)} / เลือกวิธีจ่าย — ยอดด้านล่างรวมค่าธรรมเนียมของแต่ละวิธีแล้ว ต่างกันตามวิธีจ่าย ผู้จัดงานได้รับเต็ม {formatPrice(amount)}
            </p>

            {METHODS.map((method) => {
                const total = amountWithFee(amount, method)
                const fee = feeOnly(amount, method)
                const isLoading = pending && loadingMethod === method

                return (
                    <PaymentMethodButton
                        key={method}
                        method={method}
                        totalText={formatPrice(total)}
                        feeText={`Incl. fee / รวมค่าธรรมเนียม ${formatPrice(fee)}`}
                        loading={isLoading}
                        disabled={pending}
                        onClick={() => pay(method)}
                    />
                )
            })}

            {error && <Notice tone="danger">{error}</Notice>}
        </div>
    )
}

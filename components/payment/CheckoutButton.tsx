'use client'

import { useState, useTransition } from "react"
import { createCheckoutSession } from "@/app/actions/checkout"
import { Button, Spinner } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"

export function CheckoutButton({ registrationId }: { registrationId: string }) {
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    const onClick = () => {
        setError(null)
        startTransition(async () => {
            // สำเร็จแล้ว action จะ redirect ไป Stripe เอง — เข้ามาถึง res แปลว่าล้มเหลว
            const res = await createCheckoutSession(registrationId)
            if (res && !res.ok) setError(res.error)
        })
    }

    return (
        <div className="space-y-3">
            <Button type="button" size="lg" className="w-full" disabled={pending} onClick={onClick}>
                {pending ? <Spinner /> : "ชำระเงิน (บัตรเครดิต/เดบิต หรือ PromptPay)"}
            </Button>
            {error && <Notice tone="move">{error}</Notice>}
        </div>
    )
}

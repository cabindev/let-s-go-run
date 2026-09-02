'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Notice } from "@/components/ui/Badge"
import { Spinner } from "@/components/ui/Button"

const POLL_INTERVAL_MS = 2000
const MAX_TRIES = 15 // ~30 วินาที

/**
 * แสดงตอนเพิ่งกลับมาจาก Stripe แล้วสถานะยังไม่เปลี่ยนเป็น PAID —
 * webhook ของ Stripe มักมาถึงหลัง browser redirect กลับมาสองสามวินาที
 * จึง poll ด้วย router.refresh() ให้หน้าดึงสถานะล่าสุดจาก server ซ้ำ ๆ แทนที่จะดูเหมือนค้าง
 */
export function PaymentStatusPoller({ status }: { status: string }) {
    const router = useRouter()
    const [tries, setTries] = useState(0)

    useEffect(() => {
        if (status !== "PENDING" || tries >= MAX_TRIES) return
        const timer = setTimeout(() => {
            setTries((n) => n + 1)
            router.refresh()
        }, POLL_INTERVAL_MS)
        return () => clearTimeout(timer)
    }, [status, tries, router])

    if (status !== "PENDING") return null

    return (
        <Notice tone="sky" title="Confirming Payment / กำลังตรวจสอบการชำระเงิน">
            <div className="flex items-center gap-2">
                <Spinner />
                <p>Please wait, we&apos;re confirming your payment... / โปรดรอสักครู่ ระบบกำลังยืนยันการชำระเงินของคุณ...</p>
            </div>
            {tries >= MAX_TRIES && (
                <p className="mt-2 text-[13px]">
                    Still not confirmed — try refreshing this page, or check back shortly / ยังไม่เห็นการยืนยันกลับมา ลองรีเฟรชหน้านี้อีกครั้ง หรือรอสักครู่แล้วเข้ามาดูใหม่
                </p>
            )}
        </Notice>
    )
}

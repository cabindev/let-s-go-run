'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Notice } from "@/components/ui/Badge"
import { Button, Spinner } from "@/components/ui/Button"

const POLL_INTERVAL_MS = 2000
/** รอรวมสูงสุด ~2 นาที — PromptPay ผ่านธนาคารบางแห่งใช้เวลาเกิน 30 วินาทีได้ */
const MAX_TRIES = 60
/** ผ่านไปเท่านี้แล้วยังไม่เข้า ถือว่านานผิดปกติ เริ่มบอกทางออกให้ผู้ใช้ */
const SLOW_AFTER_TRIES = 15

/**
 * แสดงตอนเพิ่งกลับมาจาก Stripe แล้วสถานะยังไม่เปลี่ยนเป็น PAID
 *
 * webhook ของ Stripe มักมาถึงหลัง browser redirect กลับมาสองสามวินาที (PromptPay
 * นานกว่าบัตร เพราะต้องรอธนาคารยืนยันอีกทอด) จึง poll ด้วย router.refresh()
 * ให้หน้าดึงสถานะล่าสุดซ้ำ ๆ แทนที่จะดูเหมือนค้าง
 *
 * สิ่งที่ผู้ใช้ต้องรู้ระหว่างรอ คือ "รอได้ ไม่ต้องกดซ้ำ และเงินไม่หายแน่นอน"
 * จึงโชว์เวลาที่ผ่านไปให้เห็นว่าระบบยังทำงานอยู่จริง ไม่ใช่ค้าง
 */
export function PaymentStatusPoller({ status }: { status: string }) {
    const router = useRouter()
    const [tries, setTries] = useState(0)
    const [checking, setChecking] = useState(false)

    const done = status !== "PENDING"

    useEffect(() => {
        if (done || tries >= MAX_TRIES) return
        const timer = setTimeout(() => {
            setTries((n) => n + 1)
            router.refresh()
        }, POLL_INTERVAL_MS)
        return () => clearTimeout(timer)
    }, [done, tries, router])

    if (done) return null

    const seconds = tries * (POLL_INTERVAL_MS / 1000)
    const slow = tries >= SLOW_AFTER_TRIES
    const gaveUp = tries >= MAX_TRIES

    const checkNow = () => {
        setChecking(true)
        router.refresh()
        setTimeout(() => setChecking(false), 1500)
    }

    if (gaveUp) {
        return (
            <Notice tone="move" title="ยังไม่ได้รับการยืนยันจากธนาคาร">
                <p className="leading-relaxed">
                    ถ้าคุณจ่ายเงินไปแล้ว <strong>เงินไม่หายแน่นอน</strong> — ระบบจะอัปเดตให้อัตโนมัติเมื่อได้รับแจ้งจากธนาคาร
                    และส่งอีเมลยืนยันไปให้ ถ้าเกิน 10 นาทีแล้วยังไม่มีอะไรเปลี่ยน กรุณาติดต่อทางร้านพร้อมแจ้งเวลาที่โอน
                </p>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={checkNow}
                    disabled={checking}
                >
                    {checking ? <Spinner /> : "ตรวจสอบอีกครั้ง"}
                </Button>
            </Notice>
        )
    }

    return (
        <Notice tone="sky" title="กำลังรอธนาคารยืนยันการชำระเงิน">
            <div className="flex items-center gap-2">
                <Spinner />
                <p>
                    {slow
                        ? "ใช้เวลานานกว่าปกติเล็กน้อย กำลังตรวจสอบอยู่..."
                        : "โปรดรอสักครู่ ระบบกำลังตรวจสอบให้อัตโนมัติ..."}
                </p>
            </div>

            <p className="mt-2 text-[13px] tnum">
                รอมาแล้ว {seconds} วินาที · โดยทั่วไปใช้เวลาไม่เกิน 1 นาที
            </p>

            <p className="mt-2 text-[13px] leading-relaxed">
                <strong>ไม่ต้องจ่ายซ้ำ และไม่ต้องกดปุ่มใด ๆ</strong> — หน้านี้จะเปลี่ยนเองเมื่อได้รับการยืนยัน
                ถ้าปิดหน้านี้ไปก็ไม่เป็นไร ระบบจะส่งอีเมลยืนยันให้เมื่อสำเร็จ
                และดูสถานะย้อนหลังได้ที่หน้าคำสั่งซื้อ
            </p>
        </Notice>
    )
}

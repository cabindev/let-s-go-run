'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

/**
 * นับถอยหลังเวลาชำระเงิน
 * รับเป็น timestamp (ms) เพื่อไม่ให้ค่าที่เรนเดอร์ฝั่งเซิร์ฟเวอร์กับ client ต่างกัน
 * เมื่อหมดเวลาจะรีเฟรชหน้าเพื่อให้เห็นสถานะจริงจากเซิร์ฟเวอร์
 */
export function Countdown({ deadline, className }: { deadline: number; className?: string }) {
    const router = useRouter()
    const [left, setLeft] = useState<number | null>(null)

    useEffect(() => {
        const tick = () => {
            const ms = deadline - Date.now()
            setLeft(Math.max(0, ms))
            if (ms <= 0) router.refresh()
        }
        tick()
        const id = setInterval(tick, 1000)
        return () => clearInterval(id)
    }, [deadline, router])

    // เรนเดอร์ครั้งแรกยังไม่รู้เวลา จองที่ไว้กันหน้ากระโดด
    if (left === null) return <span className={cn("tnum", className)}>&nbsp;</span>

    const totalSeconds = Math.floor(left / 1000)
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    const pad = (n: number) => String(n).padStart(2, "0")

    return (
        <span className={cn("tnum tabular-nums", left < 3600_000 && "text-danger", className)}>
            {left <= 0 ? "หมดเวลาแล้ว" : `${h}:${pad(m)}:${pad(s)}`}
        </span>
    )
}

'use client'

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useTransition } from "react"
import { cn } from "@/lib/utils"

const TYPES = [
    { key: "", label: "ทุกประเภท" },
    { key: "ONSITE", label: "Run" },
    { key: "VIRTUAL", label: "VR Run" },
]

const TABS = [
    { key: "upcoming", label: "กำลังจะถึง" },
    { key: "open", label: "เปิดรับสมัคร" },
    { key: "free", label: "ฟรี" },
    { key: "past", label: "จัดไปแล้ว" },
    { key: "all", label: "ทั้งหมด" },
]

export function EventTabs() {
    const router = useRouter()
    const pathname = usePathname()
    const params = useSearchParams()
    const [, startTransition] = useTransition()

    const current = params.get("filter") ?? "upcoming"
    const currentType = params.get("type") ?? ""

    const push = (key: string, value: string, fallback: string) => {
        const next = new URLSearchParams(params.toString())
        if (value === fallback) next.delete(key)
        else next.set(key, value)
        startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }))
    }

    const chip = (label: string, active: boolean, onClick: () => void) => (
        <button
            key={label}
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                "shrink-0 px-4 h-9 rounded-full text-[13px] font-medium tracking-tight transition-colors",
                active ? "bg-ink text-white" : "bg-paper border border-line text-ink-soft hover:text-ink"
            )}
        >
            {label}
        </button>
    )

    return (
        <div className="space-y-3">
            {/* เลือกประเภทงาน — วิ่งในงาน (ไม่ต้องส่งผล) หรือ วิ่งสะสมระยะ (ต้องส่งผล) */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0">
                {TYPES.map((t) => chip(t.label, currentType === t.key, () => push("type", t.key, "")))}
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0">
                {TABS.map((t) => chip(t.label, current === t.key, () => push("filter", t.key, "upcoming")))}
            </div>
        </div>
    )
}

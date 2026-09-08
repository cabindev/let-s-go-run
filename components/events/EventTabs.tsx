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

    /*
     * จอกว้าง = แถวเดียวคั่นด้วยเส้นตั้ง / มือถือ = สองแถวเหมือนเดิม
     *
     * ชิปทั้ง 8 ตัวยาวไม่ถึงครึ่งบรรทัดบนจอคอม การซ้อนสองแถวจึงเสียความสูงไปเปล่า ๆ
     * เกือบ 90px ก่อนถึงการ์ดงานใบแรก แต่บนมือถือถ้ายัดแถวเดียวกัน ชิปกรองสถานะ
     * จะถูกดันไปพ้นขอบจอจนคนไม่รู้ว่ามีให้เลือก เลยแยกสองแถวไว้เหมือนเดิม
     */
    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* วิ่งในงาน (ไม่ต้องส่งผล) หรือ วิ่งสะสมระยะ (ต้องส่งผล) */}
            <div
                role="group"
                aria-label="ประเภทงาน"
                className="flex gap-2 shrink-0 overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0 sm:overflow-visible"
            >
                {TYPES.map((t) => chip(t.label, currentType === t.key, () => push("type", t.key, "")))}
            </div>

            <span aria-hidden className="hidden sm:block w-px h-5 bg-line shrink-0 mx-1" />

            <div
                role="group"
                aria-label="สถานะงาน"
                className="flex gap-2 shrink-0 overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0"
            >
                {TABS.map((t) => chip(t.label, current === t.key, () => push("filter", t.key, "upcoming")))}
            </div>
        </div>
    )
}

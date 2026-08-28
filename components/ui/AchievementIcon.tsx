import type { LucideIcon } from "lucide-react"
import { Star, Footprints, Flame, Medal, Mountain, Trophy, Map, Crown, Award } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * แปลง emoji ที่แอดมินตั้งไว้ (ฟรีเท็กซ์) เป็น icon เวกเตอร์จริง
 * เพราะ emoji เป็นภาพสีตายตัว บังคับสีด้วย CSS ไม่ได้ ทำให้ทำ badge สไตล์ Nike/Apple Watch
 * (จานสีทึบ + ไอคอนคุมสีได้) ไม่ได้ถ้ายังใช้ emoji ตรงๆ — Award คือ fallback เมื่อไม่รู้จัก emoji นั้น
 */
const ICON_MAP: Record<string, LucideIcon> = {
    "⭐": Star,
    "👟": Footprints,
    "🔥": Flame,
    "🎖️": Medal,
    "🌄": Mountain,
    "💯": Trophy,
    "🗺️": Map,
    "👑": Crown,
    "🏅": Medal,
}

const SIZES = {
    sm: { box: "w-11 h-11", icon: "w-[18px] h-[18px]" },
    md: { box: "w-12 h-12", icon: "w-5 h-5" },
    lg: { box: "w-16 h-16", icon: "w-7 h-7" },
} as const

export function AchievementIcon({
    icon,
    unlocked = true,
    size = "md",
    className,
}: {
    icon?: string | null
    unlocked?: boolean
    size?: keyof typeof SIZES
    className?: string
}) {
    const Icon = (icon && ICON_MAP[icon.trim()]) || Award
    const s = SIZES[size]

    return (
        <span
            className={cn(
                "inline-flex items-center justify-center rounded-full shrink-0",
                s.box,
                unlocked
                    ? "bg-ink text-white shadow-[0_2px_10px_-2px_rgba(0,0,0,0.35)]"
                    : "bg-transparent text-ink-mute/40 ring-2 ring-line",
                className
            )}
        >
            <Icon className={s.icon} strokeWidth={2.25} />
        </span>
    )
}

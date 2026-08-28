import { Medal, Award, Trophy, Gem, Crown, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/** ไล่รูปทรงไอคอนตามระดับ — คงจานสีเดียวกับ badge ความสำเร็จ (ดำ/ขาว) ต่างกันที่รูปทรงไอคอนแทน */
const LEVEL_ICONS: Record<string, LucideIcon> = {
    Bronze: Medal,
    Silver: Award,
    Gold: Trophy,
    Platinum: Gem,
    Diamond: Crown,
}

const SIZES = {
    sm: { box: "w-8 h-8", icon: "w-4 h-4" },
    md: { box: "w-11 h-11", icon: "w-[18px] h-[18px]" },
    lg: { box: "w-16 h-16", icon: "w-7 h-7" },
} as const

export function LevelIcon({
    name,
    size = "md",
    className,
}: {
    name: string
    size?: keyof typeof SIZES
    className?: string
}) {
    const Icon = LEVEL_ICONS[name] || Medal
    const s = SIZES[size]

    return (
        <span
            className={cn(
                "inline-flex items-center justify-center rounded-full bg-ink text-white shrink-0 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.35)]",
                s.box,
                className
            )}
        >
            <Icon className={s.icon} strokeWidth={2.25} />
        </span>
    )
}

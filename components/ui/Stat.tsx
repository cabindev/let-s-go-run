import Link from "next/link"
import { cn } from "@/lib/utils"

/** ตัวเลขใหญ่ + ป้ายกำกับเล็ก — หน่วยแยกออกมาให้ตัวเลขเด่น */
export function Stat({
    label,
    value,
    unit,
    href,
    accent,
    className,
    size = "md",
}: {
    label: string
    value: string
    unit?: string
    href?: string
    accent?: string
    className?: string
    size?: "sm" | "md" | "lg"
}) {
    const sizes = {
        sm: "text-xl",
        md: "text-3xl",
        lg: "text-4xl sm:text-5xl",
    }

    const inner = (
        <>
            <p className="eyebrow">{label}</p>
            <p className={cn("numeral mt-1.5", sizes[size])} style={accent ? { color: accent } : undefined}>
                {value}
                {unit && <span className="text-[0.45em] font-semibold tracking-normal text-ink-mute ml-1.5">{unit}</span>}
            </p>
        </>
    )

    if (href) {
        return (
            <Link href={href} className={cn("block group", className)}>
                <div className="transition-opacity group-hover:opacity-70">{inner}</div>
            </Link>
        )
    }
    return <div className={className}>{inner}</div>
}

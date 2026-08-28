import { cn } from "@/lib/utils"

export interface RingData {
    /** 0–100 */
    value: number
    /** สีของเส้นวงแหวน (สด) */
    color: string
    label: string
    /** ข้อความที่แสดงในตำนานสี */
    display: string
}

/**
 * Activity Rings แบบ Apple Fitness — วงกลมซ้อนกัน 3 วง
 * ใช้แทนกราฟแท่ง/ตัวเลขกระจัดกระจาย
 */
export function Rings({ rings, size = 180, className }: { rings: RingData[]; size?: number; className?: string }) {
    const stroke = size * 0.105
    const gap = stroke * 0.42

    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className={cn("shrink-0 -rotate-90", className)}
            role="img"
            aria-label={rings.map((r) => `${r.label} ${Math.round(r.value)}%`).join(", ")}
        >
            {rings.map((ring, i) => {
                const r = size / 2 - stroke / 2 - i * (stroke + gap)
                const c = 2 * Math.PI * r
                const pct = Math.max(0, Math.min(100, ring.value))
                return (
                    <g key={ring.label}>
                        {/* รางวงแหวน — ใช้สีเดียวกันแบบจาง ให้เห็นขอบเขตบนพื้นขาว */}
                        <circle
                            cx={size / 2}
                            cy={size / 2}
                            r={r}
                            fill="none"
                            stroke={ring.color}
                            strokeOpacity={0.2}
                            strokeWidth={stroke}
                        />
                        <circle
                            cx={size / 2}
                            cy={size / 2}
                            r={r}
                            fill="none"
                            stroke={ring.color}
                            strokeWidth={stroke}
                            strokeLinecap="round"
                            strokeDasharray={c}
                            strokeDashoffset={c - (c * pct) / 100}
                        />
                    </g>
                )
            })}
        </svg>
    )
}

/**
 * ตำนานสีของวงแหวน — ป้ายใช้สีเทามาตรฐาน (อ่านง่าย)
 * แล้วบอกว่าเป็นวงไหนด้วยจุดสีนำหน้า
 */
export function RingLegend({ rings }: { rings: RingData[] }) {
    return (
        <ul className="space-y-3">
            {rings.map((r) => (
                <li key={r.label}>
                    <p className="eyebrow flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} aria-hidden />
                        {r.label}
                    </p>
                    <p className="numeral text-xl sm:text-2xl mt-1">{r.display}</p>
                </li>
            ))}
        </ul>
    )
}

/** แถบความคืบหน้าเส้นบาง */
export function Bar({ value, color = "var(--color-ink)", className }: { value: number; color?: string; className?: string }) {
    return (
        <div className={cn("w-full h-1 rounded-full bg-paper-3 overflow-hidden", className)}>
            <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
            />
        </div>
    )
}

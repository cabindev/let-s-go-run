import { cn } from "@/lib/utils"
import type { EventStatus, RegistrationStatus } from "@prisma/client"

const TONES = {
    neutral: "bg-paper-3 text-ink-soft",
    ink: "bg-ink text-white",
    move: "bg-move text-white",
    lime: "bg-lime text-white",
    sky: "bg-sky text-white",
    outline: "border border-line text-ink-soft",
} as const

export type Tone = keyof typeof TONES

export function Badge({
    children,
    tone = "neutral",
    className,
}: {
    children: React.ReactNode
    tone?: Tone
    className?: string
}) {
    return (
        <span
            className={cn(
                "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.08em] whitespace-nowrap",
                TONES[tone],
                className
            )}
        >
            {children}
        </span>
    )
}

export const EVENT_STATUS: Record<EventStatus, { label: string; tone: Tone }> = {
    OPEN: { label: "Open", tone: "lime" },
    CLOSED: { label: "Closed", tone: "neutral" },
    CANCELLED: { label: "Cancelled", tone: "move" },
}

export const REG_STATUS: Record<RegistrationStatus, { label: string; tone: Tone }> = {
    PENDING: { label: "รอชำระเงิน", tone: "ink" },
    PAID: { label: "ยืนยันแล้ว", tone: "lime" },
    EXPIRED: { label: "หมดเวลาชำระ", tone: "outline" },
    CANCELLED: { label: "ยกเลิกแล้ว", tone: "neutral" },
}

/** ถ้ากิจกรรมผ่านวันไปแล้วให้ขึ้น "จัดไปแล้ว" ไม่ว่า status จะเป็นอะไร */
export function EventStatusBadge({ status, date }: { status: EventStatus; date?: Date | string }) {
    if (status !== "CANCELLED" && date && new Date(date) < new Date()) {
        return <Badge tone="neutral">Ended</Badge>
    }
    const s = EVENT_STATUS[status]
    return <Badge tone={s.tone}>{s.label}</Badge>
}

export function RegStatusBadge({ status }: { status: RegistrationStatus }) {
    const s = REG_STATUS[status]
    return <Badge tone={s.tone}>{s.label}</Badge>
}

/** กล่องข้อความแจ้งเตือน — แถบสีด้านซ้าย + พื้นอ่อนของสีนั้น */
export function Notice({
    tone = "neutral",
    title,
    children,
    className,
}: {
    tone?: "neutral" | "move" | "lime" | "sky"
    title?: string
    children?: React.ReactNode
    className?: string
}) {
    const styles = {
        neutral: "border-l-ink-mute bg-paper-2",
        move: "border-l-move bg-rose-50",
        lime: "border-l-lime bg-lime-50",
        sky: "border-l-sky bg-sky-50",
    }
    return (
        <div className={cn("border-l-[3px] rounded-r-2xl px-4 py-3", styles[tone], className)}>
            {title && <p className="text-sm font-semibold text-ink">{title}</p>}
            {children && <div className="text-sm text-ink-soft mt-0.5">{children}</div>}
        </div>
    )
}

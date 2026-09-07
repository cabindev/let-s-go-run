import { cn } from "@/lib/utils"

export interface Step {
    key: string
    label: string
}

/** แถบบอกขั้นตอน — ตัวเลข + เส้นเชื่อม ไม่ใช้ไอคอน */
export function Stepper({ steps, current }: { steps: Step[]; current: number }) {
    return (
        <ol className="flex items-center gap-1 sm:gap-2">
            {steps.map((s, i) => {
                const done = i < current
                const active = i === current
                return (
                    <li key={s.key} className="flex items-center gap-1 sm:gap-2 min-w-0">
                        <span
                            className={cn(
                                "w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[12px] font-bold tnum transition-colors",
                                active && "bg-ink text-white",
                                done && "bg-lime text-white",
                                !active && !done && "bg-paper-3 text-ink-mute"
                            )}
                            aria-current={active ? "step" : undefined}
                        >
                            {done ? "✓" : i + 1}
                        </span>
                        <span
                            className={cn(
                                "text-[11px] font-semibold tracking-tight whitespace-nowrap hidden sm:block",
                                active ? "text-ink" : "text-ink-mute"
                            )}
                        >
                            {s.label}
                        </span>
                        {i < steps.length - 1 && (
                            <span className={cn("w-4 sm:w-8 h-px shrink-0 mx-0.5 sm:mx-1", done ? "bg-lime" : "bg-line")} />
                        )}
                    </li>
                )
            })}
        </ol>
    )
}

/**
 * ป้ายขั้นตอนเป็นภาษาอังกฤษล้วน
 *
 * เดิมเป็น "Category / เลือกประเภท" ทั้งคู่ พอวางเรียง 4 ขั้นในบรรทัดเดียวแล้วยาวเกินจอ
 * ภาษาไทยท้ายป้ายเลยถูกตัดหาย อ่านไม่จบประโยค — ตัวเลขกับหัวข้อในแต่ละขั้นบอกบริบท
 * เป็นภาษาไทยอยู่แล้ว ป้ายตรงนี้จึงเหลือคำอังกฤษสั้น ๆ พอ
 */
export const REGISTER_STEPS: Step[] = [
    { key: "category", label: "Category" },
    { key: "details", label: "Details" },
    { key: "confirm", label: "Review" },
    { key: "payment", label: "Payment" },
]

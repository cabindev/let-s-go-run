import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Step {
    key: string
    label: string
}

/**
 * แถบบอกขั้นตอน — วงกลมตัวเลข + เส้นเชื่อมที่เปลี่ยนสีตามขั้นที่ผ่านมาแล้ว
 *
 * ขั้นที่กำลังทำอยู่มีวงแหวนจาง ๆ ล้อมไว้ ทำให้ตาจับได้ทันทีว่าอยู่ตรงไหนโดยไม่ต้องอ่านป้าย
 * (บนจอมือถือป้ายข้อความถูกซ่อน เหลือแค่วงกลมล้วน ๆ จึงต้องแยกสถานะด้วยรูปทรงให้ชัด)
 */
export function Stepper({ steps, current }: { steps: Step[]; current: number }) {
    return (
        <ol className="flex items-center gap-1.5 sm:gap-2.5">
            {steps.map((s, i) => {
                const done = i < current
                const active = i === current
                return (
                    <li key={s.key} className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                        <span
                            className={cn(
                                "w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[13px] font-bold tnum transition-all",
                                active && "bg-ink text-white ring-4 ring-ink/10",
                                done && "bg-lime text-white",
                                !active && !done && "bg-paper-2 border border-line text-ink-mute"
                            )}
                            aria-current={active ? "step" : undefined}
                        >
                            {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}
                        </span>
                        <span
                            className={cn(
                                "text-[14px] font-semibold tracking-tight whitespace-nowrap hidden sm:block",
                                active ? "text-ink" : "text-ink-mute"
                            )}
                        >
                            {s.label}
                        </span>
                        {i < steps.length - 1 && (
                            <span
                                className={cn(
                                    "w-5 sm:w-8 h-0.5 shrink-0 rounded-full mx-0.5 sm:mx-1 transition-colors",
                                    done ? "bg-lime" : "bg-line"
                                )}
                            />
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

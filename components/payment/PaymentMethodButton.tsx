import { CreditCard, QrCode, type LucideIcon } from "lucide-react"
import { Spinner } from "@/components/ui/Button"
import { FEE_LABEL, type PaymentMethodChoice } from "@/lib/checkout-fees"
import { cn } from "@/lib/utils"

/**
 * ไอคอนกับคำอธิบายใต้ชื่อวิธีจ่าย
 *
 * ไม่เรียงโลโก้ธนาคารไว้ใต้ PromptPay โดยตั้งใจ — QR พร้อมเพย์สแกนจ่ายได้จากแอปธนาคารทุกแห่ง
 * ถ้าโชว์โลโก้แค่ไม่กี่ธนาคาร คนที่ใช้ธนาคารนอกรายการจะเข้าใจผิดว่าตัวเองจ่ายด้วยวิธีนี้ไม่ได้
 * ประโยคเดียวบอกได้ตรงกว่า และไม่มีธนาคารไหนตกหล่น
 */
const METHOD_META: Record<PaymentMethodChoice, { icon: LucideIcon; hint: string }> = {
    promptpay: { icon: QrCode, hint: "สแกน QR ด้วยแอปธนาคารใดก็ได้" },
    card: { icon: CreditCard, hint: "รองรับ Visa · Mastercard" },
}

/** ปุ่มเลือกวิธีจ่ายหนึ่งวิธี — ใช้ร่วมกันทั้งหน้าจ่ายค่าสมัครและหน้าจ่ายออเดอร์ร้านค้า */
export function PaymentMethodButton({
    method, totalText, feeText, loading, disabled, onClick,
}: {
    method: PaymentMethodChoice
    totalText: string
    feeText: string
    loading?: boolean
    disabled?: boolean
    onClick: () => void
}) {
    const { icon: Icon, hint } = METHOD_META[method]

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "raise w-full flex items-center gap-4 p-4 sm:px-5 rounded-3xl border border-line bg-paper text-left transition-all",
                "hover:border-ink-mute",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper-2",
                "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
        >
            <span className="w-11 h-11 shrink-0 rounded-2xl border border-line bg-paper-2 text-ink-soft flex items-center justify-center">
                <Icon className="w-5 h-5" strokeWidth={1.9} />
            </span>

            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold tracking-tight">{FEE_LABEL[method]}</span>
                <span className="block text-[13px] text-ink-mute mt-0.5">{hint}</span>
            </span>

            <span className="shrink-0 text-right max-w-[45%]">
                {loading ? (
                    <Spinner />
                ) : (
                    <>
                        <span className="numeral text-lg block">{totalText}</span>
                        <span className="block text-[13px] text-ink-mute mt-0.5 tnum">{feeText}</span>
                    </>
                )}
            </span>
        </button>
    )
}

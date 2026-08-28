import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth-helpers"
import { Card } from "@/components/ui/Card"
import { RegStatusBadge, Notice } from "@/components/ui/Badge"
import { ButtonLink } from "@/components/ui/Button"
import { SlipUploadForm } from "@/components/payment/SlipUploadForm"
import { CheckoutButton } from "@/components/payment/CheckoutButton"
import { Countdown } from "@/components/payment/Countdown"
import { isAwaitingPayment, isExpired, PAYMENT_WINDOW_HOURS } from "@/lib/expiry"
import { Stepper, REGISTER_STEPS } from "@/components/events/Stepper"
import { CopyButton } from "@/components/ui/CopyButton"
import { eventHref } from "@/lib/events"
import { formatDate, formatPrice, formatTime } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: "แจ้งชำระเงิน · Run Club" }

const BANK = {
    name: process.env.PAYMENT_BANK_NAME || "ธนาคารกสิกรไทย",
    account: process.env.PAYMENT_ACCOUNT_NO || "123-4-56789-0",
    holder: process.env.PAYMENT_ACCOUNT_NAME || "Run Club Thailand",
}

export default async function PaymentPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ from?: string; checkout?: string }>
}) {
    const { id } = await params
    const { from, checkout } = await searchParams
    const user = await requireUser()

    const registration = await prisma.registration.findUnique({
        where: { id },
        include: { event: true, category: true },
    })

    if (!registration) notFound()
    if (registration.userId !== user.id) redirect("/profile")

    // ยอดที่ต้องชำระ — ยึดตามประเภทที่เลือก ถ้าไม่มีให้ใช้ค่าของงาน
    const amount = registration.category?.price ?? registration.event.price
    if (amount <= 0) redirect(eventHref(registration.event))

    const expired = isExpired(registration)
    const canUpload = !expired && ["PENDING", "REJECTED", "WAITING"].includes(registration.status)
    const fromWizard = from === "register"
    const showCountdown = !expired && isAwaitingPayment(registration.status) && !!registration.expiresAt

    return (
        <div className="pt-4 max-w-xl mx-auto space-y-10">
            <Link
                href={eventHref(registration.event)}
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors"
            >
                <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                กลับไปหน้ากิจกรรม
            </Link>

            {fromWizard && (
                <div className="overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0">
                    <Stepper steps={REGISTER_STEPS} current={3} />
                </div>
            )}

            <div>
                <div className="flex items-start justify-between gap-3">
                    <p className="eyebrow">แจ้งชำระเงิน</p>
                    <RegStatusBadge status={registration.status} />
                </div>
                <h1 className="display text-2xl sm:text-3xl mt-2">{registration.event.title}</h1>
                <p className="text-[13px] text-ink-mute mt-2 tnum">
                    {formatDate(registration.event.date)} · {formatTime(registration.event.date)} · {registration.event.location}
                </p>
                {registration.category && (
                    <p className="text-[13px] text-ink-soft mt-1">
                        ประเภท {registration.category.name} · {registration.category.distance} กม.
                    </p>
                )}
            </div>

            {showCountdown && (
                <Notice tone="sky" title="เหลือเวลาชำระเงิน">
                    <p className="numeral text-2xl mt-1">
                        <Countdown deadline={registration.expiresAt!.getTime()} />
                    </p>
                    <p className="mt-1">
                        ต้องชำระเงินและส่งสลิปภายใน {PAYMENT_WINDOW_HOURS} ชั่วโมงหลังจอง
                        มิฉะนั้นระบบจะคืนที่นั่งให้ผู้สมัครคนอื่นโดยอัตโนมัติ
                    </p>
                </Notice>
            )}

            {checkout === "cancel" && registration.status !== "PAID" && (
                <Notice tone="neutral" title="ยกเลิกการชำระเงินด้วยบัตร">
                    <p>ยังไม่ได้ตัดเงิน คุณสามารถลองชำระใหม่ หรือโอนเงินตามช่องทางด้านล่างแทนได้</p>
                </Notice>
            )}

            {expired && (
                <Notice tone="move" title="หมดเวลาชำระเงินแล้ว">
                    <p>ระบบได้คืนที่นั่งให้ผู้สมัครคนอื่นแล้ว หากยังต้องการเข้าร่วมกรุณาสมัครใหม่</p>
                    <ButtonLink href={eventHref(registration.event)} variant="outline" size="sm" className="mt-3">
                        กลับไปหน้างาน
                    </ButtonLink>
                </Notice>
            )}

            {/* ยอด */}
            <div>
                <p className="eyebrow">ยอดที่ต้องชำระ</p>
                <p className="numeral text-4xl sm:text-5xl mt-2">{formatPrice(amount)}</p>
            </div>

            {/* สถานะ */}
            {registration.status === "PAID" && (
                <Notice tone="lime" title="ยืนยันการชำระเงินแล้ว">
                    <p>คุณเข้าร่วมกิจกรรมนี้เรียบร้อยแล้ว แล้วเจอกันที่จุดสตาร์ท</p>
                    <ButtonLink href={eventHref(registration.event)} size="sm" variant="outline" className="mt-3">
                        ดูรายละเอียดกิจกรรม
                    </ButtonLink>
                </Notice>
            )}

            {registration.status === "WAITING" && (
                <Notice tone="sky" title="รอแอดมินตรวจสอบสลิป">
                    โดยปกติใช้เวลาไม่เกิน 1 วันทำการ หากส่งผิดสามารถอัปโหลดใหม่ทับได้
                </Notice>
            )}

            {registration.status === "REJECTED" && (
                <Notice tone="move" title="สลิปไม่ผ่านการตรวจสอบ">
                    {registration.note ? <p>{registration.note}</p> : null}
                    <p className="mt-1">กรุณาอัปโหลดสลิปใหม่อีกครั้ง</p>
                </Notice>
            )}

            {registration.status === "CANCELLED" && (
                <Card className="p-6 text-center">
                    <p className="text-sm text-ink-soft">รายการนี้ถูกยกเลิกแล้ว</p>
                    <ButtonLink href={eventHref(registration.event)} variant="outline" size="sm" className="mt-4">
                        กลับไปหน้ากิจกรรม
                    </ButtonLink>
                </Card>
            )}

            {canUpload && (
                <>
                    <CheckoutButton registrationId={registration.id} />

                    <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-line" />
                        <span className="text-[11px] text-ink-mute">หรือโอนเงิน</span>
                        <div className="h-px flex-1 bg-line" />
                    </div>

                    {/* บัญชีรับโอน */}
                    <div>
                        <p className="eyebrow mb-4">โอนเงินมาที่</p>
                        <dl className="divide-y divide-line">
                            <Row label="ธนาคาร" value={BANK.name} />
                            <Row label="เลขที่บัญชี" value={BANK.account} mono action={<CopyButton value={BANK.account.replace(/-/g, "")} />} />
                            <Row label="ชื่อบัญชี" value={BANK.holder} />
                        </dl>
                    </div>

                    {registration.slipUrl && (
                        <div>
                            <p className="eyebrow mb-3">สลิปที่ส่งล่าสุด</p>
                            <a href={registration.slipUrl} target="_blank" rel="noreferrer" className="block">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={registration.slipUrl} alt="สลิป" className="max-h-64 rounded-2xl object-contain bg-paper-3 border border-line" />
                            </a>
                        </div>
                    )}

                    <SlipUploadForm registrationId={registration.id} />
                </>
            )}
        </div>
    )
}

function Row({ label, value, mono, action }: { label: string; value: string; mono?: boolean; action?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4 py-3.5">
            <dt className="text-[13px] text-ink-mute">{label}</dt>
            <dd className={`text-sm font-semibold flex items-center gap-3 ${mono ? "font-mono tnum tracking-wide" : ""}`}>
                {value}
                {action}
            </dd>
        </div>
    )
}

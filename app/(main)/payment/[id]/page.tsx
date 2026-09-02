import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth-helpers"
import { Card } from "@/components/ui/Card"
import { RegStatusBadge, Notice } from "@/components/ui/Badge"
import { ButtonLink } from "@/components/ui/Button"
import { CheckoutButton } from "@/components/payment/CheckoutButton"
import { PaymentStatusPoller } from "@/components/payment/PaymentStatusPoller"
import { Countdown } from "@/components/payment/Countdown"
import { ConfirmAction } from "@/components/ui/ConfirmAction"
import { cancelRegistration } from "@/app/actions/registration"
import { isAwaitingPayment, isExpired, PAYMENT_WINDOW_HOURS } from "@/lib/expiry"
import { Stepper, REGISTER_STEPS } from "@/components/events/Stepper"
import { eventHref, registrationAmount, SHIPPING_FEE } from "@/lib/events"
import { generateCheckinQr } from "@/lib/checkin-qr"
import { formatDate, formatPrice, formatTime } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: "แจ้งชำระเงิน · RunLudtong" }

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

    // ยอดที่ต้องชำระ — ยึดตามประเภทที่เลือก ถ้าไม่มีให้ใช้ค่าของงาน บวกค่าส่งไปรษณีย์ถ้าเลือกไว้
    const basePrice = registration.category?.price ?? registration.event.price
    const amount = registrationAmount(basePrice, registration.deliveryMethod)
    if (amount <= 0) redirect(eventHref(registration.event))

    const checkinQr = registration.status === "PAID" && registration.bib
        ? await generateCheckinQr(registration.id)
        : null

    const expired = isExpired(registration)
    const canPay = !expired && registration.status === "PENDING"
    const fromWizard = from === "register"
    const showCountdown = !expired && isAwaitingPayment(registration.status) && !!registration.expiresAt

    return (
        <div className="pt-4 max-w-xl mx-auto space-y-10">
            <Link
                href={eventHref(registration.event)}
                className="inline-flex items-center gap-2 text-[15px] font-semibold text-ink-mute hover:text-ink transition-colors"
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
                <p className="text-[15px] text-ink-mute mt-2 tnum">
                    {formatDate(registration.event.date)} · {formatTime(registration.event.date)} · {registration.event.location}
                </p>
                {registration.category && (
                    <p className="text-[15px] text-ink-soft mt-1">
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
                        ต้องชำระเงินภายใน {PAYMENT_WINDOW_HOURS} ชั่วโมงหลังจอง
                        มิฉะนั้นระบบจะคืนที่นั่งให้ผู้สมัครคนอื่นโดยอัตโนมัติ
                    </p>
                </Notice>
            )}

            {checkout === "success" && <PaymentStatusPoller status={registration.status} />}

            {checkout === "cancel" && registration.status !== "PAID" && (
                <Notice tone="neutral" title="ยกเลิกการชำระเงิน">
                    <p>ยังไม่ได้ตัดเงิน คุณสามารถลองชำระใหม่ได้อีกครั้ง</p>
                </Notice>
            )}

            {expired && (
                <Notice tone="danger" title="หมดเวลาชำระเงินแล้ว">
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
                {registration.deliveryMethod === "SHIPPING" && (
                    <p className="text-[13px] text-ink-mute mt-2">
                        รวมค่าส่งไปรษณีย์ {formatPrice(SHIPPING_FEE)} แล้ว
                    </p>
                )}
            </div>

            {/* สถานะ */}
            {registration.status === "PAID" && (
                <Notice tone="lime" title="ยืนยันการชำระเงินแล้ว">
                    <p>คุณเข้าร่วมกิจกรรมนี้เรียบร้อยแล้ว แล้วเจอกันที่จุดสตาร์ท</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                        <ButtonLink href={eventHref(registration.event)} size="sm" variant="outline">
                            ดูรายละเอียดกิจกรรม
                        </ButtonLink>
                        {registration.receiptUrl && (
                            <ButtonLink href={registration.receiptUrl} target="_blank" size="sm" variant="outline">
                                ดาวน์โหลดใบเสร็จ
                            </ButtonLink>
                        )}
                    </div>

                    {registration.deliveryMethod === "SHIPPING" ? (
                        <div className="mt-5 pt-5 border-t border-lime-900/10">
                            <p className="text-[13px] font-semibold tracking-wide">BIB {registration.bib}</p>
                            <p className="text-[13px] mt-1 leading-relaxed">
                                คุณเลือกรับทางไปรษณีย์ — ไม่ต้องมาสแกนหน้างาน ทางผู้จัดจะจัดส่งให้ตามที่อยู่ที่แจ้งไว้
                            </p>
                        </div>
                    ) : checkinQr && (
                        <div className="mt-5 pt-5 border-t border-lime-900/10 flex items-center gap-4">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={checkinQr} alt="QR รับเสื้อหน้างาน" width={120} height={120} className="rounded-xl bg-white p-1.5 shrink-0" />
                            <div>
                                <p className="text-[13px] font-semibold tracking-wide">BIB {registration.bib}</p>
                                <p className="text-[13px] mt-1 leading-relaxed">
                                    แสดง QR นี้ที่บูธรับเสื้อ/ของที่ระลึกหน้างาน
                                </p>
                            </div>
                        </div>
                    )}
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

            {canPay && (
                <div className="space-y-4">
                    <CheckoutButton registrationId={registration.id} amount={amount} />
                    <ConfirmAction
                        action={cancelRegistration.bind(null, registration.id)}
                        title="ยกเลิกการสมัคร?"
                        message="ที่นั่งของคุณจะถูกคืนให้ผู้สมัครคนอื่นทันที และต้องสมัครใหม่หากเปลี่ยนใจภายหลัง"
                        confirmLabel="ยกเลิกการสมัคร"
                        className="w-full text-center text-[13px] text-ink-mute hover:text-danger transition-colors"
                    >
                        ยกเลิกการสมัคร
                    </ConfirmAction>
                </div>
            )}
        </div>
    )
}

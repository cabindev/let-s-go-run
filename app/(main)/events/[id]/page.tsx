import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { heldSeatWhere, expireStaleRegistrations, isExpired } from "@/lib/expiry"
import { getSession } from "@/lib/auth-helpers"
import { Card } from "@/components/ui/Card"
import { RichText } from "@/components/ui/RichText"
import { Badge, EventStatusBadge, RegStatusBadge, Notice } from "@/components/ui/Badge"
import { ButtonLink, buttonClass } from "@/components/ui/Button"
import { ImageSection } from "@/components/events/ImageSection"
import { EVENT_TYPE_LABEL, headlineDistance, registerState, toOptions } from "@/lib/events"
import { generateCheckinQr } from "@/lib/checkin-qr"
import { formatDate, formatDateLong, formatDateRange, formatPrice, formatTime, formatTimeRange, relativeDay } from "@/lib/utils"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const event = await prisma.event.findUnique({ where: { id }, select: { title: true } })
    return { title: event ? `${event.title} · RunLudtong` : "ไม่พบกิจกรรม" }
}

export default async function EventDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const session = await getSession()

    // ปล่อยที่นั่งที่หมดเวลาก่อน จำนวนที่แสดงจะได้ตรงกับความจริง
    await expireStaleRegistrations()

    const event = await prisma.event.findUnique({
        where: { id },
        include: {
            categories: { orderBy: [{ sortOrder: "asc" }, { price: "asc" }] },
            images: { orderBy: [{ category: "asc" }, { sortOrder: "asc" }] },
            _count: { select: { registrations: { where: heldSeatWhere() } } },
        },
    })

    if (!event) notFound()
    // งานวิ่งสะสมระยะมีเส้นทางของตัวเอง
    if (event.type === "VIRTUAL") redirect(`/virtual/${id}`)

    const registration = session?.user
        ? await prisma.registration.findUnique({
            where: { userId_eventId: { userId: session.user.id, eventId: id } },
            select: { id: true, status: true, note: true, expiresAt: true, bib: true, deliveryMethod: true, category: { select: { name: true } } },
        })
        : null

    const checkinQr = registration?.status === "PAID" && registration.bib
        ? await generateCheckinQr(registration.id)
        : null

    const joined = event._count.registrations
    const state = registerState(event, joined)
    const options = toOptions(event, event.categories)
    // หมดเวลาชำระ = ที่นั่งถูกคืนแล้ว ถือว่ายังไม่ได้สมัคร สมัครใหม่ได้
    const isRegistered =
        !!registration && registration.status !== "CANCELLED" && !isExpired(registration)
    const gallery = event.images.map((i) => ({
        id: i.id, url: i.url, caption: i.caption, category: i.category, width: i.width, height: i.height,
    }))

    // ปุ่มหลัก — ขึ้นกับสถานะการสมัครของผู้ใช้
    const action = (() => {
        if (isRegistered) {
            const r = registration!
            if (r.status === "PENDING") {
                return (
                    <ButtonLink href={`/payment/${r.id}`} size="lg" className="w-full">
                        ชำระเงิน
                    </ButtonLink>
                )
            }
            return (
                <div className="flex items-center justify-center w-full h-14 rounded-full bg-lime text-white text-sm font-bold tracking-tight">
                    คุณเข้าร่วมแล้ว
                </div>
            )
        }
        if (!state.open) {
            return (
                <div className="flex items-center justify-center w-full h-14 rounded-full bg-paper-3 text-ink-mute text-sm font-semibold px-4 text-center">
                    {state.reason}
                </div>
            )
        }
        if (!session?.user) {
            return (
                <Link href={`/auth/signin?callbackUrl=/events/${event.id}/register`} className={buttonClass("primary", "lg", "w-full")}>
                    เข้าสู่ระบบเพื่อสมัคร
                </Link>
            )
        }
        return (
            <ButtonLink href={`/events/${event.id}/register`} size="lg" className="w-full">
                สมัคร
            </ButtonLink>
        )
    })()

    return (
        <div className="pt-4">
            <Link href="/" className="inline-flex items-center gap-2 text-[15px] font-semibold text-ink-mute hover:text-ink transition-colors">
                <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                งานวิ่งทั้งหมด
            </Link>

            {/* ภาพปก */}
            <div className="relative mt-5 aspect-[3/2] sm:aspect-[21/9] rounded-3xl overflow-hidden bg-paper-3">
                {event.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
                ) : (
                    <span className="absolute inset-0 flex items-center justify-center numeral text-[clamp(4rem,14vw,8rem)] text-ink-mute/30">
                        {headlineDistance(event, event.categories)}
                    </span>
                )}
                <span className="absolute top-5 left-5 flex flex-wrap gap-2">
                    <EventStatusBadge status={event.status} date={event.date} />
                    <Badge tone="ink">{EVENT_TYPE_LABEL[event.type]}</Badge>
                </span>
            </div>

            <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-12 mt-8">
                {/* เนื้อหา */}
                <div className="space-y-12">
                    <div>
                        <p className="eyebrow tnum">{formatDateRange(event.date, event.endDate)}</p>
                        <h1 className="display text-2xl sm:text-3xl mt-2">{event.title}</h1>
                        {event.organizer && (
                            <p className="text-sm text-ink-soft mt-2">จัดโดย {event.organizer}</p>
                        )}
                    </div>

                    {isRegistered && (
                        <Notice
                            tone={registration!.status === "PAID" ? "lime" : "sky"}
                            title={`สถานะการสมัครของคุณ`}
                        >
                            <span className="flex flex-wrap items-center gap-2 mt-1">
                                <RegStatusBadge status={registration!.status} />
                                {registration!.category && <span>ประเภท {registration!.category.name}</span>}
                            </span>

                            {registration!.deliveryMethod === "SHIPPING" ? (
                                <div className="mt-4 pt-4 border-t border-lime-900/10">
                                    <p className="text-[13px] font-semibold tracking-wide">BIB {registration!.bib}</p>
                                    <p className="text-[13px] mt-1 leading-relaxed">
                                        คุณเลือกรับทางไปรษณีย์ — ไม่ต้องมาสแกนหน้างาน ทางผู้จัดจะจัดส่งให้ตามที่อยู่ที่แจ้งไว้
                                    </p>
                                </div>
                            ) : checkinQr && (
                                <div className="mt-4 pt-4 border-t border-lime-900/10 flex items-center gap-4">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={checkinQr} alt="QR รับเสื้อหน้างาน" width={100} height={100} className="rounded-xl bg-white p-1.5 shrink-0" />
                                    <div>
                                        <p className="text-[13px] font-semibold tracking-wide">BIB {registration!.bib}</p>
                                        <p className="text-[13px] mt-1 leading-relaxed">
                                            แสดง QR นี้ที่บูธรับเสื้อ/ของที่ระลึกหน้างาน
                                        </p>
                                    </div>
                                </div>
                            )}
                        </Notice>
                    )}

                    {/* ข้อมูลงาน */}
                    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-y-8 gap-x-6">
                        <Spec label="วันจัดงาน" value={formatDate(event.date)} small />
                        <Spec label="เวลา" value={formatTimeRange(event.date, event.endDate).replace(" - ", "–").replace(" น.", "")} small nowrap />
                        <Spec label="ประเภทงาน" value={EVENT_TYPE_LABEL[event.type]} small />
                    </dl>

                    <div>
                        <p className="eyebrow">สถานที่</p>
                        <p className="text-lg tracking-tight mt-2">{event.location}</p>
                        {event.province && <p className="text-sm text-ink-mute mt-0.5">จ.{event.province}</p>}
                    </div>

                    {/* ── ลำดับ: เสื้อ → รายละเอียด → เส้นทาง → ระยะที่เปิดรับสมัคร → เหรียญ → บรรยากาศ ── */}

                    <ImageSection images={gallery} category="SHIRT" />
                    <ImageSection images={gallery} category="SIZE_GUIDE" />

                    <div>
                        <p className="eyebrow">รายละเอียด</p>
                        <RichText className="mt-3">{event.description}</RichText>
                    </div>

                    {event.rewards && (
                        <div>
                            <p className="eyebrow">สิ่งที่ผู้สมัครจะได้รับ</p>
                            <RichText className="mt-3">{event.rewards}</RichText>
                        </div>
                    )}

                    <ImageSection images={gallery} category="ROUTE" />

                    <section>
                        <p className="eyebrow mb-3">ระยะที่เปิดรับสมัคร</p>
                        <ul className="divide-y divide-line border-y border-line">
                            {options.map((o) => (
                                <li key={o.id ?? "default"} className="flex items-baseline justify-between gap-4 py-3.5">
                                    <span className="min-w-0">
                                        <span className="block text-sm font-semibold tracking-tight truncate">{o.name}</span>
                                        <span className="block text-[13px] text-ink-mute tnum mt-0.5">
                                            {o.distance} กม.{o.maxSlots ? ` · รับ ${o.maxSlots} คน` : ""}
                                        </span>
                                    </span>
                                    <span className="numeral text-lg shrink-0">{formatPrice(o.price)}</span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <ImageSection images={gallery} category="MEDAL" />
                    <ImageSection images={gallery} category="OTHER" />

                    {(event.announceAt || event.contactUrl) && (
                        <dl className="divide-y divide-line border-y border-line">
                            {event.announceAt && (
                                <div className="flex justify-between gap-4 py-3.5">
                                    <dt className="text-[15px] text-ink-mute">วันประกาศผล</dt>
                                    <dd className="text-sm font-medium tnum">{formatDate(event.announceAt)}</dd>
                                </div>
                            )}
                            {event.contactUrl && (
                                <div className="flex justify-between gap-4 py-3.5">
                                    <dt className="text-[15px] text-ink-mute shrink-0">รายละเอียดเพิ่มเติม</dt>
                                    <dd className="text-sm font-medium min-w-0">
                                        <a href={event.contactUrl} target="_blank" rel="noreferrer noopener" className="text-ink underline decoration-line hover:decoration-ink break-all">
                                            {event.contactUrl}
                                        </a>
                                    </dd>
                                </div>
                            )}
                        </dl>
                    )}

                    <ImageSection images={gallery} category="ATMOSPHERE" />
                </div>

                {/* กล่องรับสมัคร — sticky บนเดสก์ท็อป */}
                <aside className="mt-12 lg:mt-0">
                    <div className="lg:sticky lg:top-28 space-y-4">
                        <RegisterPanel event={event} options={options} state={state} action={action} />
                    </div>
                </aside>
            </div>

            {/* ปุ่มลอยบนมือถือ */}
            <div className="lg:hidden fixed bottom-[62px] inset-x-0 z-30 bg-paper/95 backdrop-blur-xl border-t border-line px-5 py-4 pb-safe">
                {action}
            </div>
            <div className="lg:hidden h-28" aria-hidden />
        </div>
    )
}

/** กล่อง "ช่วงรับสมัคร + ประเภทการแข่งขัน" ตามโครงของ race.thai.run */
function RegisterPanel({
    event, options, state, action,
}: {
    event: { registerOpenAt: Date | null; registerCloseAt: Date | null; maxParticipants: number | null; date: Date }
    options: ReturnType<typeof toOptions>
    state: ReturnType<typeof registerState>
    action: React.ReactNode
}) {
    const prices = options.map((o) => o.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)

    return (
        <Card className="p-5 sm:p-6 space-y-6">
            <div>
                <p className="eyebrow">ช่วงรับสมัคร</p>
                <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                        <dt className="text-ink-mute shrink-0">เปิดรับสมัคร</dt>
                        <dd className="text-right tnum">
                            {event.registerOpenAt
                                ? `${formatDate(event.registerOpenAt)} ${formatTime(event.registerOpenAt)}`
                                : "เปิดรับแล้ว"}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-ink-mute shrink-0">ปิดรับสมัคร</dt>
                        <dd className="text-right tnum">
                            {event.registerCloseAt
                                ? `${formatDate(event.registerCloseAt)} ${formatTime(event.registerCloseAt)}`
                                : formatDateLong(event.date)}
                        </dd>
                    </div>
                </dl>
                {event.maxParticipants && (
                    <p className="text-[13px] text-ink-mute mt-3">
                        หรือปิดรับสมัครทันทีเมื่อมีผู้สมัครครบเต็มจำนวน
                    </p>
                )}
            </div>

            <div className="border-t border-line pt-5">
                <p className="eyebrow">ค่าสมัคร</p>
                <p className="numeral text-3xl mt-1.5">
                    {minPrice === maxPrice ? formatPrice(minPrice) : `${formatPrice(minPrice)} – ${formatPrice(maxPrice)}`}
                </p>
                <p className="text-[13px] text-ink-mute mt-2 tnum">
                    {options.length > 1 ? `${options.length} ระยะให้เลือก` : `ระยะ ${options[0].distance} กม.`}
                </p>
            </div>

            <div className="hidden lg:block">{action}</div>

            {!state.open && (
                <p className="hidden lg:block text-[13px] text-ink-mute text-center -mt-2">{state.reason}</p>
            )}
        </Card>
    )
}

function Spec({
    label, value, unit, accent, small, nowrap,
}: { label: string; value: string; unit?: string; accent?: string; small?: boolean; nowrap?: boolean }) {
    return (
        <div>
            <dt className="eyebrow">{label}</dt>
            <dd
                className={`numeral mt-1.5 ${small ? "text-xl" : "text-3xl"} ${nowrap ? "whitespace-nowrap" : ""}`}
                style={accent ? { color: accent } : undefined}
            >
                {value}
                {unit && <span className="text-[0.45em] font-semibold tracking-normal text-ink-mute ml-1">{unit}</span>}
            </dd>
        </div>
    )
}

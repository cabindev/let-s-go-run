import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { heldSeatWhere, expireStaleRegistrations, isExpired } from "@/lib/expiry"
import { getSession } from "@/lib/auth-helpers"
import { Card } from "@/components/ui/Card"
import { RichText } from "@/components/ui/RichText"
import { Badge, EventStatusBadge, RegStatusBadge, Notice } from "@/components/ui/Badge"
import { Bar } from "@/components/ui/Rings"
import { Stat } from "@/components/ui/Stat"
import { ButtonLink, buttonClass } from "@/components/ui/Button"
import { ImageSection } from "@/components/events/ImageSection"
import { FinisherWall, WallTabs } from "@/components/events/FinisherWall"
import { registerState, toOptions } from "@/lib/events"
import { generateCheckinQr } from "@/lib/checkin-qr"
import { getFinisherWall, submitState, targetOf } from "@/lib/vr"
import { formatDate, formatDateRange, formatNumber, formatPrice, formatTime } from "@/lib/utils"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const event = await prisma.event.findUnique({ where: { id }, select: { title: true } })
    return { title: event ? `${event.title} · Virtual Run` : "ไม่พบกิจกรรม" }
}

export default async function VirtualEventPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ cat?: string }>
}) {
    const { id } = await params
    const { cat } = await searchParams
    const session = await getSession()

    const event = await prisma.event.findUnique({
        where: { id },
        include: {
            categories: { orderBy: [{ sortOrder: "asc" }, { distance: "asc" }] },
            images: { orderBy: [{ category: "asc" }, { sortOrder: "asc" }] },
            _count: { select: { registrations: { where: heldSeatWhere() } } },
        },
    })

    if (!event) notFound()
    // งานวิ่งในงานไม่ได้อยู่เส้นทางนี้
    if (event.type !== "VIRTUAL") redirect(`/events/${id}`)

    const [wall, myReg] = await Promise.all([
        getFinisherWall(event, cat ?? null),
        session?.user
            ? prisma.registration.findUnique({
                where: { userId_eventId: { userId: session.user.id, eventId: id } },
                include: {
                    category: { select: { name: true, distance: true } },
                    submissions: { select: { distance: true } },
                },
            })
            : null,
    ])

    const options = toOptions(event, event.categories)
    const gallery = event.images.map((i) => ({
        id: i.id, url: i.url, caption: i.caption, category: i.category, width: i.width, height: i.height,
    }))
    const regState = registerState(event, event._count.registrations)
    const subState = submitState(event)

    const isRegistered = !!myReg && myReg.status !== "CANCELLED" && !isExpired(myReg)
    const checkinQr = myReg?.status === "PAID" && myReg.bib
        ? await generateCheckinQr(myReg.id)
        : null
    const myTarget = myReg ? targetOf({ category: myReg.category, event }) : 0
    const myTotal = myReg?.submissions.reduce((s, x) => s + x.distance, 0) ?? 0
    const myPercent = myTarget > 0 ? Math.min(100, (myTotal / myTarget) * 100) : 0

    return (
        <div className="pt-4 space-y-10">
            <Link href="/" className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors">
                <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                งานวิ่งทั้งหมด
            </Link>

            {/* ภาพปก */}
            <div className="relative aspect-[3/2] sm:aspect-[21/9] rounded-3xl overflow-hidden bg-paper-3">
                {event.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
                ) : (
                    <span className="absolute inset-0 flex items-center justify-center numeral text-[clamp(4rem,14vw,8rem)] text-ink-mute/30">
                        VR
                    </span>
                )}
                <span className="absolute top-5 left-5 flex flex-wrap gap-2">
                    <EventStatusBadge status={event.status} date={event.endDate ?? event.date} />
                    <Badge tone="sky">วิ่งสะสมระยะ</Badge>
                </span>
            </div>

            {/* หัวเรื่อง */}
            <div>
                <p className="eyebrow tnum">{formatDateRange(event.date, event.endDate)}</p>
                <h1 className="display text-2xl sm:text-3xl mt-2">{event.title}</h1>
                {event.organizer && <p className="text-sm text-ink-soft mt-2">จัดโดย {event.organizer}</p>}
            </div>

            {/* สรุปของงาน */}
            <div className="grid grid-cols-3 gap-6">
                <Stat label="นักวิ่ง" value={formatNumber(wall.runners)} size="sm" />
                <Stat label="ระยะสะสมรวม" value={formatNumber(wall.totalDistance, 2)} unit="กม." size="sm" />
                <Stat label="ครบเป้าหมาย" value={formatNumber(wall.rows.filter((r) => r.finished).length)} size="sm" />
            </div>

            {/* แถบการทำงานของฉัน */}
            {isRegistered ? (
                <Card className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="eyebrow">ความคืบหน้าของคุณ</p>
                            <p className="numeral text-3xl mt-1.5">
                                {formatNumber(myTotal, 2)}
                                <span className="text-[0.4em] font-semibold tracking-normal text-ink-mute ml-1">
                                    / {formatNumber(myTarget, 2)} กม.
                                </span>
                            </p>
                        </div>
                        <div className="text-right">
                            <RegStatusBadge status={myReg!.status} />
                            {myReg!.bib && <p className="text-[11px] text-ink-mute mt-1.5 tnum">BIB {myReg!.bib}</p>}
                        </div>
                    </div>

                    <Bar value={myPercent} color={myPercent >= 100 ? "var(--ring-lime)" : "var(--color-ink)"} className="mt-4" />

                    {checkinQr && (
                        <div className="mt-4 pt-4 border-t border-line flex items-center gap-4">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={checkinQr} alt="QR รับเสื้อหน้างาน" width={100} height={100} className="rounded-xl bg-white p-1.5 shrink-0" />
                            <div>
                                <p className="text-[11px] font-semibold tracking-wide text-ink-mute">BIB {myReg!.bib}</p>
                                <p className="text-[11px] mt-1 leading-relaxed text-ink-mute">
                                    แสดง QR นี้ที่บูธรับเสื้อ/ของที่ระลึกหน้างาน
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="mt-5">
                        {myReg!.status === "PAID" ? (
                            subState.open ? (
                                <ButtonLink href={`/virtual/${event.id}/submit`} size="lg" className="w-full sm:w-auto">
                                    ส่งผลวิ่ง
                                </ButtonLink>
                            ) : (
                                <p className="text-sm text-ink-mute">{subState.reason}</p>
                            )
                        ) : (
                            <ButtonLink href={`/payment/${myReg!.id}`} size="lg" className="w-full sm:w-auto">
                                ชำระเงินเพื่อเริ่มส่งผล
                            </ButtonLink>
                        )}
                    </div>
                </Card>
            ) : (
                <Card className="p-5 sm:p-6 space-y-5">
                    <div>
                        <p className="eyebrow">ค่าสมัคร</p>
                        <p className="numeral text-3xl mt-1.5">
                            {options.length === 1
                                ? formatPrice(options[0].price)
                                : `${formatPrice(Math.min(...options.map((o) => o.price)))} – ${formatPrice(Math.max(...options.map((o) => o.price)))}`}
                        </p>
                    </div>

                    <p className="text-[11px] text-ink-mute -mt-3">
                        {options.length > 1 ? `${options.length} ระยะเป้าหมายให้เลือก · ดูรายละเอียดด้านล่าง` : `สะสมให้ครบ ${options[0].distance} กม.`}
                    </p>

                    {regState.open ? (
                        session?.user ? (
                            <ButtonLink href={`/virtual/${event.id}/register`} size="lg" className="w-full">
                                สมัครเข้าร่วม
                            </ButtonLink>
                        ) : (
                            <Link href={`/auth/signin?callbackUrl=/virtual/${event.id}/register`} className={buttonClass("primary", "lg", "w-full")}>
                                เข้าสู่ระบบเพื่อสมัคร
                            </Link>
                        )
                    ) : (
                        <div className="flex items-center justify-center w-full h-14 rounded-full bg-paper-3 text-ink-mute text-sm font-semibold px-4 text-center">
                            {regState.reason}
                        </div>
                    )}
                </Card>
            )}

            {/* วิธีการ */}
            <Notice tone="sky" title="งานนี้เป็นแบบวิ่งสะสมระยะ">
                วิ่งที่ไหน เมื่อไหร่ก็ได้ ภายใน {formatDateRange(event.date, event.endDate)} แล้วส่งผลเข้าระบบเอง
                จะส่งครั้งเดียวหรือทยอยส่งจนครบเป้าหมายก็ได้
            </Notice>

            {/* ── ลำดับ: เสื้อ → รายละเอียด → เส้นทาง → ระยะเป้าหมาย → เหรียญ → บรรยากาศ ── */}

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
                <p className="eyebrow mb-3">ระยะเป้าหมายที่เปิดรับสมัคร</p>
                <ul className="divide-y divide-line border-y border-line">
                    {options.map((o) => (
                        <li key={o.id ?? "default"} className="flex items-baseline justify-between gap-4 py-3.5">
                            <span className="min-w-0">
                                <span className="block text-sm font-semibold tracking-tight truncate">{o.name}</span>
                                <span className="block text-[11px] text-ink-mute tnum mt-0.5">
                                    สะสมให้ครบ {o.distance} กม.{o.maxSlots ? ` · รับ ${o.maxSlots} คน` : ""}
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
                            <dt className="text-[13px] text-ink-mute">วันประกาศผล</dt>
                            <dd className="text-sm font-medium tnum">{formatDate(event.announceAt)}</dd>
                        </div>
                    )}
                    {event.contactUrl && (
                        <div className="flex justify-between gap-4 py-3.5">
                            <dt className="text-[13px] text-ink-mute shrink-0">รายละเอียดเพิ่มเติม</dt>
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

            {/* Finisher Wall */}
            <section className="space-y-5">
                <div className="flex items-baseline justify-between gap-4">
                    <h2 className="display text-xl">กระดานผู้สะสมระยะ</h2>
                    <span className="eyebrow tnum">{wall.runners} คน</span>
                </div>

                <WallTabs eventId={event.id} categories={event.categories} current={cat ?? null} />
                <FinisherWall rows={wall.rows} myRegistrationId={myReg?.id} />
            </section>
        </div>
    )
}

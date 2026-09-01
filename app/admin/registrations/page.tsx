import Link from "next/link"
import type { RegistrationStatus } from "@prisma/client"
import { Download } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { cancelRegistrationAsAdmin } from "@/app/actions/admin"
import { Card } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { Badge, RegStatusBadge, REG_STATUS } from "@/components/ui/Badge"
import { ButtonLink } from "@/components/ui/Button"
import { EmptyState } from "@/components/ui/EmptyState"
import { ConfirmAction } from "@/components/admin/ConfirmAction"
import { Pagination } from "@/components/admin/Pagination"
import { RegistrationFilters } from "@/components/admin/RegistrationFilters"
import { REGISTRATION_STATUSES, buildRegistrationWhere } from "@/lib/admin-registrations-query"
import { eventHref, GENDER_OPTIONS } from "@/lib/events"
import { expireStaleRegistrations, formatTimeLeft, isAwaitingPayment, timeLeft } from "@/lib/expiry"
import { cn, formatDate, formatPrice, maskNationalId } from "@/lib/utils"

export const dynamic = "force-dynamic"

const STATUSES = REGISTRATION_STATUSES
const PAGE_SIZE = 100

export default async function AdminRegistrationsPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string; event?: string; q?: string; page?: string }>
}) {
    const { status, event: eventId, q, page: pageParam } = await searchParams
    const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1)

    // ให้สถานะที่เห็นตรงกับความจริงก่อนดึงรายการ
    await expireStaleRegistrations()

    const where = buildRegistrationWhere({ status, event: eventId, q })

    const exportParams = new URLSearchParams()
    if (status) exportParams.set("status", status)
    if (eventId) exportParams.set("event", eventId)
    if (q) exportParams.set("q", q)
    const exportHref = `/api/admin/registrations/export${exportParams.size ? `?${exportParams}` : ""}`

    const [registrations, filteredTotal, events, counts] = await Promise.all([
        prisma.registration.findMany({
            where,
            orderBy: { registeredAt: "desc" },
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
            include: {
                user: { select: { name: true, email: true, image: true } },
                event: { select: { id: true, title: true, type: true, price: true } },
                category: { select: { name: true, price: true, distance: true } },
            },
        }),
        prisma.registration.count({ where }),
        prisma.event.findMany({ select: { id: true, title: true }, orderBy: { date: "desc" } }),
        prisma.registration.groupBy({ by: ["status"], _count: { _all: true } }),
    ])

    const countOf = (s: RegistrationStatus) => counts.find((c) => c.status === s)?._count._all ?? 0
    const total = counts.reduce((sum, c) => sum + c._count._all, 0)
    const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE))
    const rangeStart = filteredTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
    const rangeEnd = rangeStart + registrations.length - 1
    const now = Date.now()

    return (
        <div className="space-y-8">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="eyebrow tnum">ทั้งหมด {total} รายการ</p>
                    <h1 className="display text-3xl sm:text-4xl mt-2">รายการลงทะเบียน</h1>
                </div>
                <ButtonLink href={exportHref} variant="outline" size="sm" className="shrink-0">
                    <Download className="w-4 h-4" strokeWidth={2.2} />
                    Excel
                </ButtonLink>
            </div>

            {/* สรุปตามสถานะ — กดเพื่อกรอง */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {STATUSES.map((s) => {
                    const active = status === s
                    const n = countOf(s)
                    return (
                        <Link
                            key={s}
                            href={active ? "/admin/registrations" : `/admin/registrations?status=${s}`}
                            className={cn(
                                "rounded-2xl border p-4 transition-colors",
                                active ? "border-ink bg-paper ring-1 ring-ink" : "border-line bg-paper hover:border-ink-mute"
                            )}
                        >
                            <p className="eyebrow truncate">{REG_STATUS[s].label}</p>
                            <p className={cn("numeral text-2xl mt-1", s === "PENDING" && n > 0 && "text-danger")}>{n}</p>
                        </Link>
                    )
                })}
            </div>

            <RegistrationFilters events={events} />

            {registrations.length === 0 ? (
                <Card>
                    <EmptyState
                        title="ไม่พบรายการลงทะเบียน"
                        description={q || status || eventId ? "ลองเปลี่ยนตัวกรองหรือคำค้นหา" : "เมื่อมีผู้สมัคร รายการจะแสดงที่นี่"}
                    />
                </Card>
            ) : (
                <>
                    <p className="eyebrow tnum">
                        แสดง {rangeStart}-{rangeEnd} จาก {filteredTotal} รายการ
                    </p>
                    <ul className="divide-y divide-line">
                        {registrations.map((r) => {
                            const amount = r.category?.price ?? r.event.price
                            const days = Math.floor((now - r.registeredAt.getTime()) / 86400000)
                            const left = timeLeft(r, new Date(now))
                            const overdue = isAwaitingPayment(r.status) && left !== null && left < 3600_000
                            const cancellable = r.status === "PENDING"

                            return (
                                <li key={r.id} className="flex items-start gap-3 py-4">
                                    <Avatar src={r.user.image} name={r.user.name} email={r.user.email} size={40} />

                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-semibold tracking-tight truncate">
                                                {r.fullName || r.user.name || r.user.email}
                                            </p>
                                            <RegStatusBadge status={r.status} />
                                            {left !== null && (
                                                <Badge tone={overdue ? "danger" : "outline"}>
                                                    เหลือ {formatTimeLeft(left)}
                                                </Badge>
                                            )}
                                            {r.bib && <span className="text-[11px] text-ink-mute tnum">BIB {r.bib}</span>}
                                        </div>

                                        <p className="text-[11px] text-ink-mute truncate mt-0.5">
                                            {r.user.email}
                                            {r.phone && ` · ${r.phone}`}
                                        </p>

                                        {(r.gender || r.bloodType || r.nationalId || r.hasParticipatedBefore !== null) && (
                                            <p className="text-[11px] text-ink-mute tnum mt-0.5">
                                                {r.gender && GENDER_OPTIONS.find((g) => g.value === r.gender)?.label}
                                                {r.bloodType && ` · กรุ๊ป ${r.bloodType}`}
                                                {r.nationalId && ` · บัตร ปชช. ${maskNationalId(r.nationalId)}`}
                                                {r.hasParticipatedBefore !== null && ` · ${r.hasParticipatedBefore ? "เคยเข้าร่วม" : "ยังไม่เคยเข้าร่วม"}`}
                                            </p>
                                        )}

                                        <Link
                                            href={eventHref(r.event)}
                                            target="_blank"
                                            className="block text-[12px] text-ink-soft hover:text-ink transition-colors truncate mt-1"
                                        >
                                            {r.event.title}
                                            {r.category && ` · ${r.category.name}`}
                                        </Link>

                                        <p className="text-[11px] text-ink-mute tnum mt-0.5">
                                            สมัคร {formatDate(r.registeredAt)}
                                            {days > 0 && ` · ${days} วันที่แล้ว`}
                                            {r.paidAt && ` · จ่าย ${formatDate(r.paidAt)}`}
                                        </p>

                                        {r.note && <p className="text-[11px] text-danger mt-1">{r.note}</p>}
                                    </div>

                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                        <p className="numeral text-base">{formatPrice(amount)}</p>
                                        {cancellable && (
                                            <ConfirmAction
                                                action={cancelRegistrationAsAdmin.bind(null, r.id)}
                                                title="ยกเลิกรายการนี้?"
                                                message={`ยกเลิกการลงทะเบียนของ ${r.fullName || r.user.email} — ที่นั่งจะถูกคืนให้ผู้สมัครคนอื่น`}
                                                confirmLabel="ยกเลิกรายการ"
                                                className="eyebrow text-ink-mute hover:text-danger transition-colors"
                                            >
                                                ยกเลิก
                                            </ConfirmAction>
                                        )}
                                    </div>
                                </li>
                            )
                        })}
                    </ul>

                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        basePath="/admin/registrations"
                        params={{ status, event: eventId, q }}
                    />
                </>
            )}
        </div>
    )
}

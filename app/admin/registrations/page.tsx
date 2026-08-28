import Link from "next/link"
import type { Prisma, RegistrationStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { cancelRegistrationAsAdmin } from "@/app/actions/admin"
import { Card } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { Badge, RegStatusBadge, REG_STATUS } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { ConfirmAction } from "@/components/admin/ConfirmAction"
import { RegistrationFilters } from "@/components/admin/RegistrationFilters"
import { eventHref } from "@/lib/events"
import { expireStaleRegistrations, formatTimeLeft, isAwaitingPayment, timeLeft } from "@/lib/expiry"
import { cn, formatDate, formatPrice } from "@/lib/utils"

export const dynamic = "force-dynamic"

/** เกินกี่วันถือว่าค้างจ่ายนานผิดปกติ */
const OVERDUE_DAYS = 3

const STATUSES: RegistrationStatus[] = ["PENDING", "WAITING", "PAID", "REJECTED", "EXPIRED", "CANCELLED"]

export default async function AdminRegistrationsPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string; event?: string; q?: string }>
}) {
    const { status, event: eventId, q } = await searchParams

    // ให้สถานะที่เห็นตรงกับความจริงก่อนดึงรายการ
    await expireStaleRegistrations()

    const where: Prisma.RegistrationWhereInput = {
        ...(STATUSES.includes(status as RegistrationStatus) ? { status: status as RegistrationStatus } : {}),
        ...(eventId ? { eventId } : {}),
        ...(q?.trim()
            ? {
                OR: [
                    { fullName: { contains: q.trim() } },
                    { phone: { contains: q.trim() } },
                    { bib: { contains: q.trim() } },
                    { user: { name: { contains: q.trim() } } },
                    { user: { email: { contains: q.trim() } } },
                ],
            }
            : {}),
    }

    const [registrations, events, counts] = await Promise.all([
        prisma.registration.findMany({
            where,
            orderBy: { registeredAt: "desc" },
            take: 200,
            include: {
                user: { select: { name: true, email: true, image: true } },
                event: { select: { id: true, title: true, type: true, price: true } },
                category: { select: { name: true, price: true, distance: true } },
            },
        }),
        prisma.event.findMany({ select: { id: true, title: true }, orderBy: { date: "desc" } }),
        prisma.registration.groupBy({ by: ["status"], _count: { _all: true } }),
    ])

    const countOf = (s: RegistrationStatus) => counts.find((c) => c.status === s)?._count._all ?? 0
    const total = counts.reduce((sum, c) => sum + c._count._all, 0)
    const now = Date.now()

    return (
        <div className="space-y-8">
            <div>
                <p className="eyebrow tnum">ทั้งหมด {total} รายการ</p>
                <h1 className="display text-3xl sm:text-4xl mt-2">รายการลงทะเบียน</h1>
            </div>

            {/* สรุปตามสถานะ — กดเพื่อกรอง */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
                            <p className={cn("numeral text-2xl mt-1", s === "PENDING" && n > 0 && "text-move")}>{n}</p>
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
                    <p className="eyebrow tnum">แสดง {registrations.length} รายการ</p>
                    <ul className="divide-y divide-line">
                        {registrations.map((r) => {
                            const amount = r.category?.price ?? r.event.price
                            const days = Math.floor((now - r.registeredAt.getTime()) / 86400000)
                            const left = timeLeft(r, new Date(now))
                            const overdue = isAwaitingPayment(r.status) && left !== null && left < 3600_000
                            const cancellable = r.status === "PENDING" || r.status === "REJECTED"

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
                                                <Badge tone={overdue ? "move" : "outline"}>
                                                    เหลือ {formatTimeLeft(left)}
                                                </Badge>
                                            )}
                                            {r.bib && <span className="text-[11px] text-ink-mute tnum">BIB {r.bib}</span>}
                                        </div>

                                        <p className="text-[11px] text-ink-mute truncate mt-0.5">
                                            {r.user.email}
                                            {r.phone && ` · ${r.phone}`}
                                        </p>

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

                                        {r.note && <p className="text-[11px] text-move mt-1">{r.note}</p>}
                                    </div>

                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                        <p className="numeral text-base">{formatPrice(amount)}</p>
                                        {cancellable && (
                                            <ConfirmAction
                                                action={cancelRegistrationAsAdmin.bind(null, r.id)}
                                                title="ยกเลิกรายการนี้?"
                                                message={`ยกเลิกการลงทะเบียนของ ${r.fullName || r.user.email} — ที่นั่งจะถูกคืนให้ผู้สมัครคนอื่น`}
                                                confirmLabel="ยกเลิกรายการ"
                                                className="eyebrow text-ink-mute hover:text-move transition-colors"
                                            >
                                                ยกเลิก
                                            </ConfirmAction>
                                        )}
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                </>
            )}
        </div>
    )
}

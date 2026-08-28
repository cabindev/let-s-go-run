import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { heldSeatWhere } from "@/lib/expiry"
import { Card, SectionTitle, MoreLink } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { Stat } from "@/components/ui/Stat"
import { RegStatusBadge, EventStatusBadge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { formatBaht, formatDate, formatNumber, formatTime } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function AdminDashboard() {
    const now = new Date()

    const [userCount, eventCount, openEvents, paidCount, waitingCount, pendingCount, revenue, recentRegs, upcoming] =
        await Promise.all([
            prisma.user.count(),
            prisma.event.count(),
            prisma.event.count({ where: { status: "OPEN", date: { gte: now } } }),
            prisma.registration.count({ where: { status: "PAID" } }),
            prisma.registration.count({ where: { status: "WAITING" } }),
            prisma.registration.count({ where: { status: "PENDING" } }),
            prisma.registration.findMany({
                where: { status: "PAID" },
                select: { event: { select: { price: true } }, category: { select: { price: true } } },
            }),
            prisma.registration.findMany({
                take: 8,
                orderBy: { registeredAt: "desc" },
                include: {
                    user: { select: { name: true, email: true, image: true } },
                    event: { select: { title: true } },
                },
            }),
            prisma.event.findMany({
                where: { date: { gte: now } },
                orderBy: { date: "asc" },
                take: 5,
                include: { _count: { select: { registrations: { where: heldSeatWhere() } } } },
            }),
        ])

    // ยอดจริงต่อรายการคือราคาของประเภทที่เลือก ถ้าไม่มีประเภทค่อยใช้ราคาของงาน
    const totalRevenue = revenue.reduce((s, r) => s + (r.category?.price ?? r.event.price), 0)

    return (
        <div className="space-y-16">
            <div>
                <p className="eyebrow">ณ วันที่ {formatDate(now)}</p>
                <h1 className="display text-3xl sm:text-4xl mt-2">ภาพรวม</h1>
            </div>

            <section>
                <p className="eyebrow">รายได้จากค่าสมัคร (ยืนยันแล้ว)</p>
                <p className="numeral text-4xl sm:text-5xl mt-2">{formatBaht(totalRevenue)}</p>
            </section>

            <section className="grid grid-cols-2 sm:grid-cols-4 gap-y-9 gap-x-6">
                <Stat label="ผู้ใช้งาน" value={formatNumber(userCount)} href="/admin/users" />
                <Stat label="กิจกรรม" value={formatNumber(eventCount)} href="/admin/events" />
                <Stat label="ยืนยันแล้ว" value={formatNumber(paidCount)} accent="var(--color-lime)" />
                <Stat label="รอตรวจสลิป" value={formatNumber(waitingCount)} accent={waitingCount ? "var(--color-move)" : undefined} href="/admin/slips" />
            </section>

            <p className="eyebrow -mt-10">
                เปิดรับสมัคร {openEvents} ·{" "}
                <Link href="/admin/registrations?status=PENDING" className="hover:text-ink transition-colors underline underline-offset-2">
                    รอชำระเงิน {pendingCount}
                </Link>
            </p>

            {pendingCount > 0 && (
                <Link
                    href="/admin/registrations?status=PENDING"
                    className="flex items-center justify-between gap-4 border-l-[3px] border-l-ink-mute bg-paper-2 rounded-r-2xl px-5 py-4 hover:bg-paper-3 transition-colors -mt-4"
                >
                    <span className="text-sm">
                        <strong className="tnum">{pendingCount}</strong> รายการสมัครแล้วยังไม่ชำระเงิน
                    </span>
                    <span className="eyebrow shrink-0">ดูรายชื่อ</span>
                </Link>
            )}

            {waitingCount > 0 && (
                <Link
                    href="/admin/slips"
                    className="flex items-center justify-between gap-4 border-l-[3px] border-l-move bg-rose-50 rounded-r-2xl px-5 py-4 hover:bg-rose-100 transition-colors"
                >
                    <span className="text-sm">
                        <strong className="tnum">{waitingCount}</strong> สลิปรอการตรวจสอบ
                    </span>
                    <span className="eyebrow shrink-0">ตรวจสอบ</span>
                </Link>
            )}

            <div className="grid gap-12 lg:grid-cols-2">
                <section>
                    <SectionTitle title="ลงทะเบียนล่าสุด" action={<MoreLink href="/admin/registrations" />} />
                    {recentRegs.length === 0 ? (
                        <Card><EmptyState title="ยังไม่มีการลงทะเบียน" /></Card>
                    ) : (
                        <ul className="divide-y divide-line">
                            {recentRegs.map((r) => (
                                <li key={r.id} className="flex items-center gap-3 py-3.5">
                                    <Avatar src={r.user.image} name={r.user.name} email={r.user.email} size={36} />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold tracking-tight truncate">{r.user.name || r.user.email}</p>
                                        <p className="text-[11px] text-ink-mute truncate">{r.event.title}</p>
                                    </div>
                                    <RegStatusBadge status={r.status} />
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section>
                    <SectionTitle title="กิจกรรมที่จะถึง" action={<MoreLink href="/admin/events">จัดการ</MoreLink>} />
                    {upcoming.length === 0 ? (
                        <Card>
                            <EmptyState title="ยังไม่มีกิจกรรม" actionLabel="สร้างกิจกรรม" actionHref="/admin/events/new" />
                        </Card>
                    ) : (
                        <ul className="divide-y divide-line">
                            {upcoming.map((e) => (
                                <li key={e.id}>
                                    <Link href={`/admin/events/${e.id}/edit`} className="flex items-center gap-3 py-3.5 group">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold tracking-tight truncate group-hover:text-ink-soft transition-colors">{e.title}</p>
                                            <p className="text-[11px] text-ink-mute tnum">
                                                {formatDate(e.date)} · {formatTime(e.date)} · {e._count.registrations}
                                                {e.maxParticipants ? `/${e.maxParticipants}` : ""} คน
                                            </p>
                                        </div>
                                        <EventStatusBadge status={e.status} date={e.date} />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    )
}

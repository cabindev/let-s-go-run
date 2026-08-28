import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { heldSeatWhere } from "@/lib/expiry"
import { eventHref } from "@/lib/events"
import { deleteEvent } from "@/app/actions/admin"
import { Card } from "@/components/ui/Card"
import { EventStatusBadge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { ButtonLink } from "@/components/ui/Button"
import { ConfirmAction } from "@/components/admin/ConfirmAction"
import { formatDate, formatPrice, formatTime } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function AdminEventsPage() {
    const events = await prisma.event.findMany({
        orderBy: { date: "desc" },
        include: {
            _count: {
                select: {
                    // นับ "ที่นั่งที่ถูกจอง" (รวมคนที่ยังไม่จ่าย) และ "ยืนยันแล้ว" แยกกัน
                    registrations: { where: heldSeatWhere() },
                },
            },
            registrations: { where: { status: "PAID" }, select: { id: true } },
        },
    })

    return (
        <div className="space-y-10">
            <div className="flex items-end justify-between gap-4">
                <div>
                    <p className="eyebrow tnum">{events.length} กิจกรรม</p>
                    <h1 className="display text-3xl sm:text-4xl mt-2">กิจกรรม</h1>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                    <ButtonLink href="/admin/events/new">+ งานวิ่ง</ButtonLink>
                    <ButtonLink href="/admin/events/new?type=VIRTUAL" variant="outline">+ งานสะสมระยะ</ButtonLink>
                </div>
            </div>

            {events.length === 0 ? (
                <Card>
                    <EmptyState
                        title="ยังไม่มีกิจกรรม"
                        description="สร้างกิจกรรมแรกเพื่อเริ่มเปิดรับสมัคร"
                        actionLabel="สร้างกิจกรรม"
                        actionHref="/admin/events/new"
                    />
                </Card>
            ) : (
                <ul className="divide-y divide-line">
                    {events.map((e) => (
                        <li key={e.id} className="flex items-center gap-4 py-4">
                            <div className="min-w-0 flex-1">
                                <Link href={`/admin/events/${e.id}/edit`} className="font-semibold tracking-tight hover:text-ink-soft transition-colors line-clamp-1">
                                    {e.title}
                                </Link>
                                <p className="text-[11px] text-ink-mute mt-1 tnum">
                                    {formatDate(e.date)} · {formatTime(e.date)} · {e.location}
                                </p>
                                <p className="text-[11px] text-ink-mute tnum">
                                    {formatPrice(e.price)} · {e.distance} กม. · จอง {e._count.registrations}
                                    {e.maxParticipants ? `/${e.maxParticipants}` : ""} คน · ยืนยันแล้ว {e.registrations.length}
                                    {e._count.registrations > e.registrations.length && (
                                        <>
                                            {" · "}
                                            <span className="text-move">
                                                ค้างจ่าย {e._count.registrations - e.registrations.length}
                                            </span>
                                        </>
                                    )}
                                </p>
                                <div className="mt-2">
                                    <EventStatusBadge status={e.status} date={e.date} />
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                                <Link href={eventHref(e)} target="_blank" className="eyebrow text-ink-mute hover:text-ink transition-colors">
                                    ดูหน้าจริง
                                </Link>
                                <Link href={`/admin/events/${e.id}/edit`} className="eyebrow text-ink-soft hover:text-ink transition-colors">
                                    แก้ไข
                                </Link>
                                <ConfirmAction
                                    action={deleteEvent.bind(null, e.id)}
                                    title="ลบกิจกรรมนี้?"
                                    message={
                                        e._count.registrations > 0
                                            ? `"${e.title}" มีผู้สมัคร ${e._count.registrations} คน การลบจะลบข้อมูลการลงทะเบียนทั้งหมดและคำนวณระยะทางสะสมของผู้ใช้ใหม่ ย้อนกลับไม่ได้`
                                            : `"${e.title}" จะถูกลบถาวร ย้อนกลับไม่ได้`
                                    }
                                    confirmLabel="ลบกิจกรรม"
                                    className="eyebrow text-ink-mute hover:text-move transition-colors"
                                >
                                    ลบ
                                </ConfirmAction>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

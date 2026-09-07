import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { heldSeatWhere, inviteSeatWhere } from "@/lib/expiry"
import { eventHref } from "@/lib/events"
import { deleteEvent } from "@/app/actions/admin"
import { Card } from "@/components/ui/Card"
import { EventStatusBadge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { ButtonLink } from "@/components/ui/Button"
import { ConfirmAction } from "@/components/ui/ConfirmAction"
import { formatDate, formatPrice, formatTime } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function AdminEventsPage() {
    const events = await prisma.event.findMany({
        orderBy: { date: "desc" },
        include: {
            _count: {
                select: {
                    // นับ "ที่นั่งที่ถูกจอง" (รวมคนที่ยังไม่จ่าย) และ "ยืนยันแล้ว" แยกกัน
                    // ตรงนี้ใช้ heldSeatWhere() ตั้งใจ — หน้าแอดมินต้องเห็น "คนจริงทั้งหมด"
                    // รวมสิทธิพิเศษด้วย เพราะเป็นตัวเลขที่ใช้สั่งเสื้อ/เหรียญ/แจ้งประกัน
                    registrations: { where: heldSeatWhere() },
                },
            },
            registrations: { where: { status: "PAID" }, select: { id: true } },
        },
    })

    // ที่นั่งสิทธิพิเศษของแต่ละงาน — แยกออกมาเพราะ _count ใส่ตัวกรองให้ relation เดียวกันได้แค่ชุดเดียว
    const inviteRows = await prisma.registration.groupBy({
        by: ["eventId"],
        where: inviteSeatWhere(),
        _count: { _all: true },
    })
    const inviteByEvent = new Map(inviteRows.map((r) => [r.eventId, r._count._all]))

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
                    {events.map((e) => {
                        const invited = inviteByEvent.get(e.id) ?? 0
                        const publicSeats = e._count.registrations - invited
                        return (
                        <li key={e.id} className="flex items-center gap-4 py-4">
                            <div className="min-w-0 flex-1">
                                <Link href={`/admin/events/${e.id}/edit`} className="font-semibold tracking-tight hover:text-ink-soft transition-colors line-clamp-1">
                                    {e.title}
                                </Link>
                                <p className="text-[11px] text-ink-mute mt-1 tnum">
                                    {formatDate(e.date)} · {formatTime(e.date)} · {e.location}
                                </p>
                                <p className="text-[11px] text-ink-mute tnum">
                                    {formatPrice(e.price)} · {e.distance} กม. · จอง {publicSeats}
                                    {e.maxParticipants ? `/${e.maxParticipants}` : ""} คน · ยืนยันแล้ว {e.registrations.length}
                                    {e._count.registrations > e.registrations.length && (
                                        <>
                                            {" · "}
                                            <span className="text-danger">
                                                ค้างจ่าย {e._count.registrations - e.registrations.length}
                                            </span>
                                        </>
                                    )}
                                </p>
                                {/* สิทธิพิเศษอยู่นอกโควตา — ยอดรวมจริงคือตัวเลขที่ใช้สั่งของ ต้องเห็นคู่กันเสมอ */}
                                {invited > 0 && (
                                    <p className="text-[11px] text-ink-mute tnum">
                                        + สิทธิพิเศษ {invited} คน ·{" "}
                                        <span className="text-ink font-semibold">รวมจริง {e._count.registrations} คน</span>
                                    </p>
                                )}
                                <div className="mt-2">
                                    <EventStatusBadge status={e.status} date={e.type === "VIRTUAL" ? (e.endDate ?? e.date) : e.date} />
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                                <Link href={eventHref(e)} target="_blank" className="eyebrow text-ink-mute hover:text-ink transition-colors">
                                    ดูหน้าจริง
                                </Link>
                                <Link href={`/admin/events/${e.id}/codes`} className="eyebrow text-ink-soft hover:text-ink transition-colors">
                                    สิทธิพิเศษ
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
                                    className="eyebrow text-ink-mute hover:text-danger transition-colors"
                                >
                                    ลบ
                                </ConfirmAction>
                            </div>
                        </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}

import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { inviteSeatWhere, publicSeatWhere } from "@/lib/expiry"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { isEventOver } from "@/lib/events"
import { cn, formatDate } from "@/lib/utils"

export const dynamic = "force-dynamic"

/**
 * ภาพรวมโควตาสิทธิพิเศษทุกงาน — สปอนเซอร์ / แขกผู้จัดงาน / ทีมงาน
 *
 * หน้านี้ตอบคำถามเดียวที่ถูกถามบ่อยที่สุด: "สปอนเซอร์แต่ละรายใช้สิทธิ์ไปกี่คนแล้ว"
 * โดยไม่ต้องเปิดทีละงาน ส่วนการออกโค้ดจริงอยู่ในหน้าของแต่ละงาน เพราะโค้ดผูกกับงานเสมอ
 */
export default async function AdminInviteCodesPage() {
    const events = await prisma.event.findMany({
        orderBy: { date: "desc" },
        select: {
            id: true,
            title: true,
            date: true,
            endDate: true,
            type: true,
            status: true,
            maxParticipants: true,
            inviteCodes: {
                orderBy: [{ groupName: "asc" }, { createdAt: "asc" }],
                select: {
                    id: true,
                    groupName: true,
                    maxUses: true,
                    usedCount: true,
                    active: true,
                    discountPercent: true,
                    expiresAt: true,
                },
            },
        },
    })

    // ที่นั่งจริงของแต่ละงาน แยกสาธารณะกับสิทธิพิเศษ
    const [publicRows, inviteRows] = await Promise.all([
        prisma.registration.groupBy({ by: ["eventId"], where: publicSeatWhere(), _count: { _all: true } }),
        prisma.registration.groupBy({ by: ["eventId"], where: inviteSeatWhere(), _count: { _all: true } }),
    ])
    const publicBy = new Map(publicRows.map((r) => [r.eventId, r._count._all]))
    const inviteBy = new Map(inviteRows.map((r) => [r.eventId, r._count._all]))

    const withCodes = events.filter((e) => e.inviteCodes.length > 0)
    const withoutCodes = events.filter((e) => e.inviteCodes.length === 0 && !isEventOver(e))

    const totalIssued = withCodes.reduce(
        (s, e) => s + e.inviteCodes.reduce((n, c) => n + c.maxUses, 0), 0
    )
    const totalUsed = withCodes.reduce(
        (s, e) => s + e.inviteCodes.reduce((n, c) => n + c.usedCount, 0), 0
    )

    return (
        <div className="space-y-8">
            <div>
                <p className="eyebrow tnum">
                    {withCodes.length === 0
                        ? "ยังไม่มีงานที่ออกโค้ด"
                        : `ออกไปแล้ว ${totalIssued} สิทธิ์ · ใช้ไป ${totalUsed} · เหลือ ${totalIssued - totalUsed}`}
                </p>
                <h1 className="display text-3xl sm:text-4xl mt-2">สิทธิพิเศษ</h1>
                <p className="text-[13px] text-ink-soft mt-3 max-w-2xl leading-relaxed">
                    โควตาฟรีสำหรับสปอนเซอร์ แขกผู้จัดงาน และทีมงาน — ที่นั่งจากโค้ด
                    <strong> อยู่นอกจำนวนรับสมัครที่ประกาศไว้</strong> เช่นรับ 400 + โค้ด 40 = 440 คนจริง
                    ให้ใช้ยอดรวมในการสั่งเสื้อ เหรียญ และแจ้งประกัน
                </p>
            </div>

            {withCodes.length === 0 && withoutCodes.length === 0 && (
                <Card>
                    <EmptyState
                        title="ยังไม่มีกิจกรรมที่เปิดรับสมัคร"
                        description="สร้างกิจกรรมก่อน แล้วจึงออกโค้ดสิทธิพิเศษให้สปอนเซอร์ได้"
                        actionLabel="สร้างกิจกรรม"
                        actionHref="/admin/events/new"
                    />
                </Card>
            )}

            {withCodes.map((e) => {
                const pub = publicBy.get(e.id) ?? 0
                const inv = inviteBy.get(e.id) ?? 0
                const over = isEventOver(e)

                // รวมโค้ดที่ชื่อกลุ่มเดียวกันเข้าด้วยกัน — คำถามคือ "กลุ่มนี้ใช้ไปเท่าไหร่"
                // ไม่ใช่ "โค้ดใบนี้สถานะอะไร" (ดูรายใบได้ในหน้าของงาน)
                const groups = new Map<string, { issued: number; used: number; codes: number; percent: number; active: number }>()
                for (const c of e.inviteCodes) {
                    const g = groups.get(c.groupName) ?? { issued: 0, used: 0, codes: 0, percent: c.discountPercent, active: 0 }
                    g.issued += c.maxUses
                    g.used += c.usedCount
                    g.codes += 1
                    if (c.active) g.active += 1
                    groups.set(c.groupName, g)
                }

                return (
                    <Card key={e.id} className={cn("p-6 sm:p-8", over && "opacity-60")}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <Link
                                    href={`/admin/invite-codes/${e.id}`}
                                    className="font-semibold tracking-tight hover:text-ink-soft transition-colors"
                                >
                                    {e.title}
                                </Link>
                                <p className="text-[11px] text-ink-mute tnum mt-1">
                                    {formatDate(e.date)}
                                    {over && " · จบไปแล้ว"}
                                </p>
                            </div>
                            <Link
                                href={`/admin/invite-codes/${e.id}`}
                                className="eyebrow text-ink hover:text-ink-soft transition-colors shrink-0"
                            >
                                จัดการโค้ด →
                            </Link>
                        </div>

                        <p className="text-[12px] text-ink-mute tnum mt-3">
                            ผู้เข้าร่วมจริง: {pub}
                            {e.maxParticipants ? `/${e.maxParticipants}` : ""} ทั่วไป + {inv} สิทธิพิเศษ ={" "}
                            <span className="text-ink font-semibold">รวม {pub + inv} คน</span>
                        </p>

                        <ul className="mt-5 divide-y divide-line border-t border-line">
                            {[...groups.entries()].map(([name, g]) => (
                                <li key={name} className="py-3">
                                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                                        <span className="text-[14px] tracking-tight font-medium">{name}</span>
                                        <span className="text-[12px] text-ink-mute tnum shrink-0">
                                            ใช้ไป <span className="text-ink font-semibold">{g.used}</span> / {g.issued} สิทธิ์
                                            {g.percent < 100 && ` · ลด ${g.percent}%`}
                                            {g.active === 0 && " · ปิดใช้งานทั้งหมด"}
                                        </span>
                                    </div>
                                    <div className="mt-2 h-1.5 rounded-full bg-paper-3 overflow-hidden">
                                        <div
                                            className="h-full bg-ink rounded-full"
                                            style={{ width: `${g.issued > 0 ? (g.used / g.issued) * 100 : 0}%` }}
                                        />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </Card>
                )
            })}

            {withoutCodes.length > 0 && (
                <div>
                    <p className="eyebrow mb-4">งานที่ยังไม่มีโค้ดสิทธิพิเศษ</p>
                    <ul className="divide-y divide-line">
                        {withoutCodes.map((e) => (
                            <li key={e.id} className="flex items-center gap-4 py-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[14px] tracking-tight truncate">{e.title}</p>
                                    <p className="text-[11px] text-ink-mute tnum mt-0.5">
                                        {formatDate(e.date)} · ผู้สมัคร {publicBy.get(e.id) ?? 0}
                                        {e.maxParticipants ? `/${e.maxParticipants}` : ""} คน
                                    </p>
                                </div>
                                {e.status !== "OPEN" && <Badge tone="neutral">ปิดรับสมัคร</Badge>}
                                <Link
                                    href={`/admin/invite-codes/${e.id}`}
                                    className="eyebrow text-ink hover:text-ink-soft transition-colors shrink-0"
                                >
                                    + ออกโค้ด
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}

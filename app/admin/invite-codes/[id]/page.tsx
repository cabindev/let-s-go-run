import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { inviteSeatWhere, publicSeatWhere } from "@/lib/expiry"
import { Card } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { InviteCodeManager } from "@/components/admin/InviteCodeManager"
import { formatDate } from "@/lib/utils"

export const dynamic = "force-dynamic"

/**
 * โควตาสิทธิพิเศษของงานหนึ่ง — สปอนเซอร์ / แขกผู้จัดงาน / ทีมงาน
 *
 * ที่นั่งจากโค้ดอยู่นอกจำนวนรับสมัครที่ประกาศไว้ หน้านี้จึงต้องโชว์ "ยอดรวมจริง"
 * คู่กับยอดสาธารณะเสมอ เพราะเป็นตัวเลขที่ผู้จัดใช้สั่งเสื้อ เหรียญ และแจ้งประกัน
 */
export default async function EventInviteCodesPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params

    const event = await prisma.event.findUnique({
        where: { id },
        select: { id: true, title: true, date: true, maxParticipants: true },
    })
    if (!event) notFound()

    const [codes, publicSeats, inviteSeats, categories, usedRegs] = await Promise.all([
        prisma.inviteCode.findMany({
            where: { eventId: id },
            orderBy: [{ groupName: "asc" }, { createdAt: "asc" }],
        }),
        prisma.registration.count({ where: { eventId: id, ...publicSeatWhere() } }),
        prisma.registration.count({ where: { eventId: id, ...inviteSeatWhere() } }),
        prisma.raceCategory.findMany({
            where: { eventId: id },
            orderBy: { sortOrder: "asc" },
            select: { id: true, name: true, maxSlots: true },
        }),
        prisma.registration.findMany({
            where: { eventId: id, inviteCodeId: { not: null }, ...inviteSeatWhere() },
            orderBy: { registeredAt: "desc" },
            select: {
                id: true,
                fullName: true,
                phone: true,
                shirtSize: true,
                bib: true,
                registeredAt: true,
                inviteGroupName: true,
                inviteCodeId: true,
                category: { select: { name: true } },
                user: { select: { email: true } },
            },
        }),
    ])

    // จำนวนต่อรุ่น แยกสาธารณะกับสิทธิพิเศษ — ใช้ประเมินคลื่นปล่อยตัวและของรายรุ่น
    const [publicByCat, inviteByCat] = await Promise.all([
        prisma.registration.groupBy({
            by: ["categoryId"],
            where: { eventId: id, categoryId: { not: null }, ...publicSeatWhere() },
            _count: { _all: true },
        }),
        prisma.registration.groupBy({
            by: ["categoryId"],
            where: { eventId: id, categoryId: { not: null }, ...inviteSeatWhere() },
            _count: { _all: true },
        }),
    ])
    const publicCat = new Map(publicByCat.map((r) => [r.categoryId!, r._count._all]))
    const inviteCat = new Map(inviteByCat.map((r) => [r.categoryId!, r._count._all]))

    const issued = codes.reduce((sum, c) => sum + c.maxUses, 0)
    const used = codes.reduce((sum, c) => sum + c.usedCount, 0)

    return (
        <div className="space-y-10">
            <div>
                <Link href="/admin/invite-codes" className="eyebrow text-ink-mute hover:text-ink transition-colors">
                    ← สิทธิพิเศษทุกงาน
                </Link>
                <h1 className="display text-3xl sm:text-4xl mt-3">โควตาสิทธิพิเศษ</h1>
                <p className="text-[13px] text-ink-soft mt-2">
                    {event.title} · {formatDate(event.date)}
                </p>
            </div>

            {/*
                ตัวเลขที่ใช้สั่งของ ต้องอยู่บนสุดและอ่านได้ในแวบเดียว

                เขียนเป็นรายการ "ชื่อ—จำนวน" ไม่ใช่สมการ 20 + 0 = 20 เพราะตอนยังไม่มีใคร
                ใช้สิทธิ์ สมการจะกลายเป็นบรรทัดที่ไม่ได้บอกอะไรเลย และตัวเลขใหญ่สามก้อน
                เรียงกันทำให้ต้องหยุดอ่านว่าอันไหนคืออะไร
            */}
            <Card className="p-6 sm:p-8">
                <p className="eyebrow">จำนวนคนที่ต้องเตรียมของให้</p>

                <dl className="mt-5 space-y-4">
                    <div className="flex items-baseline justify-between gap-4">
                        <dt className="min-w-0">
                            <span className="text-[14px] tracking-tight font-medium">ผู้สมัครทั่วไป</span>
                            <span className="block text-[11px] text-ink-mute mt-0.5">
                                จ่ายค่าสมัครเอง
                                {event.maxParticipants
                                    ? ` · เหลือรับได้อีก ${Math.max(0, event.maxParticipants - publicSeats)} ที่`
                                    : " · ไม่จำกัดจำนวน"}
                            </span>
                        </dt>
                        <dd className="numeral text-2xl tnum shrink-0">
                            {publicSeats}
                            {event.maxParticipants && (
                                <span className="text-ink-mute text-base"> / {event.maxParticipants}</span>
                            )}
                        </dd>
                    </div>

                    <div className="flex items-baseline justify-between gap-4">
                        <dt className="min-w-0">
                            <span className="text-[14px] tracking-tight font-medium">สิทธิพิเศษ (ใช้โค้ด)</span>
                            <span className="block text-[11px] text-ink-mute mt-0.5">
                                ไม่เสียค่าสมัคร ·{" "}
                                {event.maxParticipants
                                    ? `ไม่นับรวมใน ${event.maxParticipants} ที่ที่ประกาศไว้`
                                    : "แยกจากผู้สมัครทั่วไป"}
                            </span>
                        </dt>
                        <dd className="numeral text-2xl tnum shrink-0">{inviteSeats}</dd>
                    </div>

                    <div className="flex items-baseline justify-between gap-4 border-t border-line pt-4">
                        <dt className="min-w-0">
                            <span className="text-[14px] tracking-tight font-semibold">รวมทั้งหมด</span>
                            <span className="block text-[11px] text-ink-mute mt-0.5">
                                สั่งเสื้อ เหรียญ และแจ้งประกันตามตัวเลขนี้
                            </span>
                        </dt>
                        <dd className="numeral text-4xl tnum shrink-0">{publicSeats + inviteSeats}</dd>
                    </div>
                </dl>

                {issued > 0 && event.maxParticipants && (
                    <p className="text-[12px] text-ink-mute mt-5 leading-relaxed">
                        ออกโค้ดไว้ {issued} สิทธิ์ ถ้าใช้ครบทุกใบและผู้สมัครทั่วไปเต็ม
                        จำนวนคนจริงจะอยู่ที่ <strong>{event.maxParticipants + issued} คน</strong> — มากสุดเท่านี้ ไม่เกินกว่านี้
                    </p>
                )}

                {categories.length > 0 && (
                    <div className="mt-6 pt-5 border-t border-line">
                        <p className="eyebrow text-ink-mute mb-1">แยกตามรุ่น</p>
                        <ul className="divide-y divide-line">
                            {categories.map((c) => {
                                const pub = publicCat.get(c.id) ?? 0
                                const inv = inviteCat.get(c.id) ?? 0
                                return (
                                    <li key={c.id} className="flex items-baseline justify-between gap-4 py-2.5">
                                        <span className="text-[13px] tracking-tight">{c.name}</span>
                                        <span className="text-[12px] tnum shrink-0">
                                            <span className="text-ink-mute">
                                                ทั่วไป {pub}
                                                {c.maxSlots ? `/${c.maxSlots}` : ""}
                                                {inv > 0 && ` · สิทธิพิเศษ ${inv}`}
                                            </span>
                                            {inv > 0 && (
                                                <span className="font-semibold"> · รวม {pub + inv}</span>
                                            )}
                                        </span>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                )}
            </Card>

            <InviteCodeManager
                eventId={event.id}
                codes={codes}
                issued={issued}
                used={used}
                registrations={usedRegs.map((r) => ({
                    id: r.id,
                    fullName: r.fullName,
                    phone: r.phone,
                    shirtSize: r.shirtSize,
                    email: r.user.email,
                    bib: r.bib,
                    categoryName: r.category?.name ?? null,
                    registeredAt: r.registeredAt,
                    groupName: r.inviteGroupName,
                    inviteCodeId: r.inviteCodeId,
                }))}
            />

            {codes.length === 0 && (
                <Card>
                    <EmptyState
                        title="ยังไม่มีโค้ดสิทธิพิเศษ"
                        description="ออกโค้ดให้สปอนเซอร์ แขกผู้จัดงาน หรือทีมงาน แล้วส่งรหัสให้เขาไปกรอกในหน้าสมัครตามปกติ"
                    />
                </Card>
            )}
        </div>
    )
}

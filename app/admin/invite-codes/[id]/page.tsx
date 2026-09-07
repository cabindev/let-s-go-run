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

            {/* ยอดรวมจริง — ตัวเลขที่ใช้สั่งของ ต้องอยู่บนสุดและอ่านได้ในแวบเดียว */}
            <Card className="p-6 sm:p-8">
                <p className="eyebrow">จำนวนผู้เข้าร่วมจริง</p>
                <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1">
                    <span className="numeral text-4xl tnum">{publicSeats}</span>
                    <span className="text-[13px] text-ink-soft pb-1">
                        ทั่วไป{event.maxParticipants ? ` / ${event.maxParticipants}` : ""}
                    </span>
                    <span className="numeral text-2xl text-ink-mute pb-0.5">+</span>
                    <span className="numeral text-4xl tnum">{inviteSeats}</span>
                    <span className="text-[13px] text-ink-soft pb-1">สิทธิพิเศษ</span>
                    <span className="numeral text-2xl text-ink-mute pb-0.5">=</span>
                    <span className="numeral text-4xl tnum">{publicSeats + inviteSeats}</span>
                    <span className="text-[13px] text-ink pb-1 font-semibold">คน</span>
                </div>
                <p className="text-[12px] text-ink-mute mt-4 leading-relaxed">
                    สิทธิพิเศษอยู่<strong>นอก</strong>จำนวนรับสมัครที่ประกาศไว้ — ใช้ตัวเลข{" "}
                    <strong>รวม {publicSeats + inviteSeats} คน</strong> ในการสั่งเสื้อ เหรียญ และแจ้งประกัน
                    ส่วนเกินสูงสุดเท่ากับสิทธิ์ที่ออกไว้ทั้งหมด ({issued} สิทธิ์) ไม่เกินกว่านั้น
                </p>

                {categories.length > 0 && (
                    <ul className="mt-6 divide-y divide-line border-t border-line">
                        {categories.map((c) => {
                            const pub = publicCat.get(c.id) ?? 0
                            const inv = inviteCat.get(c.id) ?? 0
                            return (
                                <li key={c.id} className="flex items-baseline justify-between gap-4 py-2.5">
                                    <span className="text-[13px] tracking-tight">{c.name}</span>
                                    <span className="text-[12px] text-ink-mute tnum shrink-0">
                                        {pub}
                                        {c.maxSlots ? `/${c.maxSlots}` : ""} ทั่วไป
                                        {inv > 0 && (
                                            <>
                                                {" + "}
                                                {inv} สิทธิพิเศษ ={" "}
                                                <span className="text-ink font-semibold">{pub + inv}</span>
                                            </>
                                        )}
                                    </span>
                                </li>
                            )
                        })}
                    </ul>
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

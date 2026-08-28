import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Card, SectionTitle } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { RegStatusBadge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { SlipReview } from "@/components/admin/SlipReview"
import { formatDate, formatPrice, formatTime } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function AdminSlipsPage() {
    const [waiting, recent] = await Promise.all([
        prisma.registration.findMany({
            where: { status: "WAITING" },
            include: { user: true, event: true, category: { select: { name: true, price: true } } },
            orderBy: { registeredAt: "asc" },
        }),
        prisma.registration.findMany({
            where: { status: { in: ["PAID", "REJECTED"] }, slipUrl: { not: null } },
            include: {
                user: { select: { name: true, email: true, image: true } },
                event: { select: { title: true } },
                category: { select: { name: true } },
            },
            orderBy: { paidAt: "desc" },
            take: 10,
        }),
    ])

    return (
        <div className="space-y-14">
            <div>
                <p className="eyebrow tnum">
                    {waiting.length > 0 ? `${waiting.length} รายการรอตรวจสอบ` : "ไม่มีรายการรอตรวจสอบ"}
                </p>
                <h1 className="display text-3xl sm:text-4xl mt-2">ตรวจสลิป</h1>
            </div>

            {waiting.length === 0 ? (
                <Card>
                    <EmptyState title="ตรวจสอบครบทุกรายการแล้ว" description="เมื่อมีผู้ใช้ส่งสลิปเข้ามา รายการจะแสดงที่นี่" />
                </Card>
            ) : (
                <div className="space-y-6">
                    {waiting.map((reg) => (
                        <Card key={reg.id} className="p-5 grid gap-6 sm:grid-cols-[minmax(0,200px)_1fr]">
                            <a href={reg.slipUrl!} target="_blank" rel="noreferrer" className="block rounded-2xl overflow-hidden bg-paper-2">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={reg.slipUrl!} alt="สลิปการโอนเงิน" className="w-full max-h-64 object-contain" />
                            </a>

                            <div className="space-y-4">
                                <div>
                                    <Link href={`/admin/events/${reg.eventId}/edit`} className="font-semibold tracking-tight hover:text-ink-soft transition-colors">
                                        {reg.event.title}
                                    </Link>
                                    <p className="text-[11px] text-ink-mute mt-1 tnum">
                                        {formatDate(reg.event.date)} · {formatTime(reg.event.date)}
                                        {reg.category && ` · ${reg.category.name}`}
                                    </p>
                                    {/* ยอดที่ต้องตรวจคือราคาของประเภทที่เลือก ไม่ใช่ราคาเริ่มต้นของงาน */}
                                    <p className="numeral text-2xl mt-1.5">{formatPrice(reg.category?.price ?? reg.event.price)}</p>
                                </div>

                                <div className="flex items-center gap-3 py-3 border-y border-line">
                                    <Avatar src={reg.user.image} name={reg.user.name} email={reg.user.email} size={36} />
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold tracking-tight truncate">{reg.user.name || "ไม่ระบุชื่อ"}</p>
                                        <p className="text-[11px] text-ink-mute truncate">{reg.user.email}</p>
                                    </div>
                                </div>

                                <p className="text-[11px] text-ink-mute tnum">
                                    ลงทะเบียน {formatDate(reg.registeredAt)} {formatTime(reg.registeredAt)}
                                </p>

                                <SlipReview registrationId={reg.id} />
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {recent.length > 0 && (
                <section>
                    <SectionTitle title="ตรวจสอบล่าสุด" />
                    <ul className="divide-y divide-line">
                        {recent.map((r) => (
                            <li key={r.id} className="flex items-center gap-3 py-3.5">
                                <Avatar src={r.user.image} name={r.user.name} email={r.user.email} size={34} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold tracking-tight truncate">{r.user.name || r.user.email}</p>
                                    <p className="text-[11px] text-ink-mute truncate">
                                        {r.event.title}{r.category && ` · ${r.category.name}`}
                                    </p>
                                    {r.note && <p className="text-[11px] text-move truncate">{r.note}</p>}
                                </div>
                                <RegStatusBadge status={r.status} />
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    )
}

import { Suspense } from "react"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth-helpers"
import { getUserStats } from "@/lib/stats"
import { getLevel } from "@/lib/levels"
import { buildEventWhere, EVENT_INCLUDE } from "@/lib/event-query"
import { Card } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { ButtonLink } from "@/components/ui/Button"
import { EventSearch } from "@/components/events/EventSearch"
import { EventListCard } from "@/components/events/EventListCard"
import { EventTabs } from "@/components/events/EventTabs"
import { formatNumber } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function HomePage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; province?: string; distance?: string; filter?: string; type?: string }>
}) {
    const sp = await searchParams
    const session = await getSession()

    const events = await prisma.event.findMany({
        where: buildEventWhere(sp),
        orderBy: sp.filter === "past" ? { date: "desc" } : { date: "asc" },
        include: EVENT_INCLUDE,
        take: 60,
    })

    const hasSearch = !!(sp.q || sp.province || sp.distance || sp.type)

    return (
        <>
            {/* ───── ส่วนหัว + ค้นหา ───── */}
            <section className="bg-paper border-b border-line">
                <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
                    {session?.user ? (
                        <Suspense fallback={<div className="h-20" />}>
                            <UserStrip userId={session.user.id} name={session.user.name} />
                        </Suspense>
                    ) : (
                        <div className="max-w-xl mx-auto text-center">
                            <p className="eyebrow">ระบบรับสมัครงานวิ่ง</p>
                            <h1 className="display text-[clamp(1.4rem,3vw,1.875rem)] mt-1.5">
                                หางานวิ่งที่ใช่ แล้วสมัครได้เลย
                            </h1>
                            <p className="text-ink-soft text-[13px] mt-2">
                                ค้นหาจากชื่องานหรือระยะทาง เลือกประเภทที่ต้องการ แล้วสมัครผ่านระบบได้ทันที
                            </p>
                        </div>
                    )}

                    <div className="mt-6 max-w-3xl mx-auto">
                        <Suspense fallback={<div className="h-44 sm:h-32 rounded-3xl bg-paper-2 animate-pulse" />}>
                            <EventSearch />
                        </Suspense>
                    </div>
                </div>
            </section>

            {/* ───── รายการงานวิ่ง ───── */}
            <section className="max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-10 space-y-6">
                <Suspense fallback={null}>
                    <EventTabs />
                </Suspense>

                {events.length === 0 ? (
                    <Card>
                        <EmptyState
                            title={hasSearch ? "ไม่พบงานที่ตรงกับที่ค้นหา" : "ยังไม่มีงานวิ่งในหมวดนี้"}
                            description={hasSearch ? "ลองเปลี่ยนคำค้นหา จังหวัด หรือระยะทาง" : "กลับมาดูใหม่อีกครั้งเร็ว ๆ นี้"}
                        />
                    </Card>
                ) : (
                    <>
                        <p className="eyebrow tnum">{events.length} งาน</p>
                        <div className="grid gap-4 lg:grid-cols-2">
                            {events.map((e) => <EventListCard key={e.id} event={e} />)}
                        </div>
                    </>
                )}
            </section>
        </>
    )
}

/** แถบสรุปสถิติแบบสั้น สำหรับผู้ใช้ที่ล็อกอินแล้ว */
async function UserStrip({ userId, name }: { userId: string; name?: string | null }) {
    const stats = await getUserStats(userId)
    const level = getLevel(stats.totalDistance)
    const firstName = (name || "นักวิ่ง").split(" ")[0]

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="eyebrow">สวัสดี</p>
                    <h1 className="display text-2xl sm:text-3xl mt-1">{firstName}</h1>
                </div>
                <Link href="/profile" className="eyebrow hover:text-ink transition-colors shrink-0 pb-1">
                    ดูโปรไฟล์
                </Link>
            </div>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <Mini label="ระยะทางรวม" value={`${formatNumber(stats.totalDistance, 1)} กม.`} />
                <Mini label="กิจกรรมที่จบ" value={formatNumber(stats.completedEvents)} />
                <Mini label="ระดับ" value={`${level.current.icon} ${level.current.name}`} />
                <Mini label="อันดับ" value={stats.rank ? `#${stats.rank}` : "—"} />
                {stats.pendingPayments > 0 && (
                    <ButtonLink href="/profile#registrations" size="sm" variant="solid" className="ml-auto">
                        ชำระเงิน {stats.pendingPayments} รายการ
                    </ButtonLink>
                )}
            </div>
        </div>
    )
}

function Mini({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="eyebrow">{label}</p>
            <p className="numeral text-lg mt-0.5">{value}</p>
        </div>
    )
}

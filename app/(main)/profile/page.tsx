import Link from "next/link"
import type { Event, Registration } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth-helpers"
import { getUserStats } from "@/lib/stats"
import { getAchievementBoard, ACHIEVEMENT_UNIT } from "@/lib/achievements"
import { getLevel } from "@/lib/levels"
import { Card, SectionTitle, MoreLink } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { Bar } from "@/components/ui/Rings"
import { Stat } from "@/components/ui/Stat"
import { RegStatusBadge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { AchievementIcon } from "@/components/ui/AchievementIcon"
import { LevelIcon } from "@/components/ui/LevelIcon"
import { ButtonLink } from "@/components/ui/Button"
import { ProfileEditDialog } from "@/components/profile/ProfileEditDialog"
import SignOutButton from "@/components/auth/SignOutButton"
import { eventHref, isEventOver } from "@/lib/events"
import { expireStaleRegistrations, isAwaitingPayment, isExpired, formatTimeLeft, timeLeft } from "@/lib/expiry"
import { cn, formatDate, formatDateRange, formatNumber, formatPrice, formatTime } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: "โปรไฟล์ · Run Club" }

export default async function ProfilePage() {
    const sessionUser = await requireUser()

    // ให้สถานะที่ผู้ใช้เห็นตรงกับความจริงก่อนดึงข้อมูล
    await expireStaleRegistrations()

    const [user, stats, achievements, registrations] = await Promise.all([
        prisma.user.findUnique({ where: { id: sessionUser.id } }),
        getUserStats(sessionUser.id),
        getAchievementBoard(sessionUser.id),
        prisma.registration.findMany({
            where: { userId: sessionUser.id },
            include: { event: true, category: { select: { price: true } } },
            orderBy: [{ event: { date: "desc" } }],
        }),
    ])

    if (!user) return null

    const level = getLevel(stats.totalDistance)
    const unlocked = achievements.filter((a) => a.unlocked)

    const now = new Date()
    // งานสะสมระยะยังถือว่า "กำลังดำเนินอยู่" จนกว่าจะเลยวันสิ้นสุด
    const upcoming = registrations.filter((r) => !isEventOver(r.event, now) && r.status !== "CANCELLED")
    const history = registrations.filter((r) => isEventOver(r.event, now) || r.status === "CANCELLED")

    return (
        <div className="pt-4 space-y-16">
            {/* หัวโปรไฟล์ */}
            <section className="animate-rise">
                <div className="flex items-start justify-between gap-4">
                    <Avatar src={user.image} name={user.name} email={user.email} size={80} />
                    <ProfileEditDialog user={user} />
                </div>

                <h1 className="display text-2xl sm:text-3xl mt-4 break-words">{user.name || "นักวิ่ง"}</h1>
                <p className="text-sm text-ink-mute mt-2 break-all">{user.email}</p>

                <div className="flex items-center gap-2 mt-4">
                    <LevelIcon name={level.current.name} size="sm" />
                    <span className="text-sm font-semibold tracking-tight">{level.current.name}</span>
                </div>

                {user.bio && <p className="text-sm text-ink-soft mt-4 max-w-lg leading-relaxed">{user.bio}</p>}
            </section>

            {/* ตัวเลขหลัก */}
            <section>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-9 gap-x-6">
                    <Stat label="ระยะทางรวม" value={formatNumber(stats.totalDistance, 1)} unit="กม." />
                    <Stat label="กิจกรรมที่จบ" value={formatNumber(stats.completedEvents)} />
                    <Stat label="เดือนนี้" value={formatNumber(stats.monthDistance, 1)} unit="กม." />
                    <Stat label="อันดับ" value={stats.rank ? `#${stats.rank}` : "—"} href="/leaderboard" />
                </div>

                <div className="mt-10">
                    <div className="flex items-baseline justify-between mb-3">
                        <p className="eyebrow">{level.current.name}</p>
                        {level.next && <p className="eyebrow">{level.next.name}</p>}
                    </div>
                    <Bar value={level.progress} color="var(--color-ink)" />
                    <p className="text-xs text-ink-mute mt-3">
                        {level.next
                            ? `อีก ${formatNumber(level.distanceToNext, 1)} กม. เพื่อเลื่อนเป็น ${level.next.name}`
                            : "คุณอยู่ในระดับสูงสุดแล้ว"}
                    </p>
                </div>
            </section>

            {/* เดือนนี้ */}
            <section>
                <SectionTitle title="เดือนนี้" />
                <div className="grid grid-cols-3 gap-6">
                    <Stat label="ระยะทาง" value={formatNumber(stats.monthDistance, 1)} unit="กม." size="sm" />
                    <Stat label="กิจกรรม" value={String(stats.monthEvents)} size="sm" />
                    <Stat label="สัปดาห์นี้" value={formatNumber(stats.weekDistance, 1)} unit="กม." size="sm" />
                </div>
            </section>

            {/* การลงทะเบียน */}
            <section id="registrations" className="scroll-mt-24">
                <SectionTitle title="กิจกรรมของฉัน" action={<MoreLink href="/">หากิจกรรมใหม่</MoreLink>} />

                {registrations.length === 0 ? (
                    <Card>
                        <EmptyState
                            title="ยังไม่มีการลงทะเบียน"
                            description="เลือกกิจกรรมที่สนใจแล้วเริ่มสะสมระยะทาง"
                            actionLabel="ดูกิจกรรม"
                            actionHref="/"
                        />
                    </Card>
                ) : (
                    <div className="space-y-8">
                        {upcoming.length > 0 && (
                            <div>
                                <p className="eyebrow mb-3">กำลังจะถึง · {upcoming.length}</p>
                                <ul className="divide-y divide-line">
                                    {upcoming.map((r) => <RegRow key={r.id} reg={r} />)}
                                </ul>
                            </div>
                        )}
                        {history.length > 0 && (
                            <div>
                                <p className="eyebrow mb-3">ประวัติ · {history.length}</p>
                                <ul className="divide-y divide-line">
                                    {history.map((r) => <RegRow key={r.id} reg={r} past />)}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* ความสำเร็จ */}
            <section id="achievements" className="scroll-mt-24">
                <SectionTitle title={`ความสำเร็จ ${unlocked.length}/${achievements.length}`} />

                {achievements.length === 0 ? (
                    <Card>
                        <EmptyState title="ยังไม่มีความสำเร็จ" description="ผู้ดูแลระบบยังไม่ได้ตั้งค่าความสำเร็จ" />
                    </Card>
                ) : (
                    // แสดงทุกระดับเป็นไกด์ให้เห็นภาพรวม — ที่ยังไม่ปลดล็อกทำให้จางลงแทนที่จะซ่อนไป
                    // เพื่อไม่ให้ดูเหมือนแถบ 0% ที่ท้อ แต่ยังบอกเป้าหมายที่เหลือให้เห็น
                    <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-3">
                        {achievements.map((a) => (
                            <div
                                key={a.id}
                                className={cn(
                                    "bg-paper border border-line rounded-2xl p-4 text-center",
                                    !a.unlocked && "border-dashed"
                                )}
                                title={a.description ?? undefined}
                            >
                                <AchievementIcon icon={a.icon} unlocked={a.unlocked} className="mx-auto" />
                                <span
                                    className={cn(
                                        "block text-[11px] font-medium mt-2 leading-tight line-clamp-2",
                                        !a.unlocked && "text-ink-mute"
                                    )}
                                >
                                    {a.name}
                                </span>
                                {a.unlocked && a.unlockedAt ? (
                                    <span className="block text-[10px] text-ink-mute mt-1 tnum">{formatDate(a.unlockedAt)}</span>
                                ) : (
                                    <span className="block text-[10px] text-ink-mute/70 mt-1 tnum">
                                        {formatNumber(a.threshold)} {ACHIEVEMENT_UNIT[a.type]}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <div>
                <SignOutButton className="text-[13px] font-semibold text-ink-mute hover:text-move transition-colors" />
            </div>
        </div>
    )
}

function RegRow({ reg, past }: { reg: Registration & { event: Event; category: { price: number } | null }; past?: boolean }) {
    const expired = isExpired(reg)
    const needsPayment = isAwaitingPayment(reg.status) && !past && !expired
    const isVirtual = reg.event.type === "VIRTUAL"
    const left = timeLeft(reg)

    return (
        <li className={past ? "opacity-60" : ""}>
            <div className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0 flex-1">
                    <Link href={eventHref(reg.event)} className="font-semibold tracking-tight hover:text-ink-soft transition-colors line-clamp-1">
                        {reg.event.title}
                    </Link>
                    <p className="text-[11px] text-ink-mute mt-1 tnum">
                        {isVirtual
                            ? `สะสมระยะ ${formatDateRange(reg.event.date, reg.event.endDate)}`
                            : `${formatDate(reg.event.date)} · ${formatTime(reg.event.date)}`}
                        {` · ${formatPrice(reg.category?.price ?? reg.event.price)}`}
                    </p>
                    <div className="mt-2">
                        {/* แสดงสถานะจริง — หมดเวลาแล้วถือว่า EXPIRED แม้ยังไม่ถูกกวาดในฐานข้อมูล */}
                        <RegStatusBadge status={expired ? "EXPIRED" : reg.status} />
                    </div>
                    {reg.status === "REJECTED" && reg.note && (
                        <p className="text-[11px] text-move mt-1.5">{reg.note}</p>
                    )}
                    {needsPayment && left !== null && (
                        <p className="text-[11px] text-move mt-1.5 tnum">
                            เหลือเวลาชำระเงิน {formatTimeLeft(left)}
                        </p>
                    )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                    {needsPayment && (
                        <ButtonLink href={`/payment/${reg.id}`} size="sm">
                            ชำระเงิน
                        </ButtonLink>
                    )}
                    {isVirtual && reg.status === "PAID" && !past && (
                        <ButtonLink href={`/virtual/${reg.event.id}/submit`} size="sm" variant="outline">
                            ส่งผลวิ่ง
                        </ButtonLink>
                    )}
                </div>
            </div>
        </li>
    )
}

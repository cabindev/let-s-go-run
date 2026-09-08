import Link from "next/link"
import type { Event, Registration } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth-helpers"
import { getUserStats } from "@/lib/stats"
import { getAchievementBoard, ACHIEVEMENT_UNIT } from "@/lib/achievements"
import { getLevel } from "@/lib/levels"
import { Card } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { Bar } from "@/components/ui/Rings"
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
export const metadata = { title: "โปรไฟล์ · RunLudtong" }

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
        /*
         * คอลัมน์เดียวกว้างเท่าจอแอป แล้วซอยเนื้อหาเป็นการ์ดทีละเรื่อง
         *
         * ของเดิมเป็นตัวเลขกับรายการลอยอยู่บนพื้นเทาเปล่า ๆ เว้นห่างกันทีละ 64px
         * และยืดเต็มความกว้าง 1152px ทำให้แถบระดับกลายเป็นเส้นบางยาวเกือบเมตร
         * ส่วนหัวข้อกับตัวเลขห่างกันจนไม่รู้ว่าอันไหนเป็นพวกเดียวกัน
         */
        <div className="pt-4 pb-8 max-w-2xl mx-auto space-y-4">
            {/* ───── บัตรประจำตัว ───── */}
            <Card className="raise p-4 sm:p-5 animate-rise">
                <div className="flex items-center gap-3.5">
                    <Avatar src={user.image} name={user.name} email={user.email} size={56} />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                            <h1 className="display text-lg truncate">{user.name || "นักวิ่ง"}</h1>
                            <span className="inline-flex items-center gap-1.5 shrink-0">
                                <LevelIcon name={level.current.name} size="sm" />
                                <span className="text-[13px] font-semibold tracking-tight">{level.current.name}</span>
                            </span>
                        </div>
                        <p className="text-[13px] text-ink-mute mt-0.5 truncate">{user.email}</p>
                    </div>
                    <ProfileEditDialog user={user} />
                </div>

                {user.bio && (
                    <p className="text-[14px] text-ink-soft leading-relaxed mt-4 pt-4 border-t border-line">
                        {user.bio}
                    </p>
                )}
            </Card>

            {/* ───── สรุปตัวเลข ─────
                รวมสามส่วนของเดิม (ตัวเลขหลัก / แถบระดับ / เดือนนี้) มาไว้ใบเดียว
                ของเดิม "เดือนนี้" ถูกพิมพ์สองที่ด้วยเลขเดียวกัน ห่างกันครึ่งจอ */}
            <Card className="raise overflow-hidden">
                <div className="grid grid-cols-3 divide-x divide-line">
                    <Metric label="ระยะทางรวม" value={formatNumber(stats.totalDistance, 1)} unit="กม." />
                    <Metric label="กิจกรรมที่จบ" value={formatNumber(stats.completedEvents)} />
                    <Metric label="อันดับ" value={stats.rank ? `#${stats.rank}` : "—"} href="/leaderboard" />
                </div>

                <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
                    <Metric small label="เดือนนี้" value={formatNumber(stats.monthDistance, 1)} unit="กม." />
                    <Metric small label="สัปดาห์นี้" value={formatNumber(stats.weekDistance, 1)} unit="กม." />
                    <Metric small label="งานเดือนนี้" value={formatNumber(stats.monthEvents)} />
                </div>

                <div className="border-t border-line px-4 sm:px-5 py-4">
                    <div className="flex items-baseline justify-between mb-2">
                        <p className="eyebrow">{level.current.name}</p>
                        {level.next && <p className="eyebrow">{level.next.name}</p>}
                    </div>
                    <Bar value={level.progress} color="var(--color-ink)" />
                    <p className="text-[12px] text-ink-mute mt-2 tnum">
                        {level.next
                            ? `อีก ${formatNumber(level.distanceToNext, 1)} กม. เพื่อเลื่อนเป็น ${level.next.name}`
                            : "คุณอยู่ในระดับสูงสุดแล้ว"}
                    </p>
                </div>
            </Card>

            {/* ───── กิจกรรมของฉัน ───── */}
            <section id="registrations" className="scroll-mt-24 space-y-3">
                <div className="flex items-baseline justify-between gap-4">
                    <h2 className="display text-lg">กิจกรรมของฉัน</h2>
                    <Link href="/" className="text-[14px] font-semibold text-ink-mute hover:text-ink transition-colors shrink-0">
                        หากิจกรรมใหม่
                    </Link>
                </div>

                {registrations.length === 0 ? (
                    <Card className="raise">
                        <EmptyState
                            title="ยังไม่มีการลงทะเบียน"
                            description="เลือกกิจกรรมที่สนใจแล้วเริ่มสะสมระยะทาง"
                            actionLabel="ดูกิจกรรม"
                            actionHref="/"
                        />
                    </Card>
                ) : (
                    <>
                        {upcoming.length > 0 && <RegGroup title={`กำลังจะถึง · ${upcoming.length}`} regs={upcoming} />}
                        {history.length > 0 && <RegGroup title={`ประวัติ · ${history.length}`} regs={history} past />}
                    </>
                )}
            </section>

            {/* ───── ความสำเร็จ ───── */}
            <section id="achievements" className="scroll-mt-24 space-y-3">
                <h2 className="display text-lg">
                    ความสำเร็จ
                    <span className="text-[13px] font-normal text-ink-mute tnum ml-2">
                        {unlocked.length}/{achievements.length}
                    </span>
                </h2>

                {achievements.length === 0 ? (
                    <Card className="raise">
                        <EmptyState title="ยังไม่มีความสำเร็จ" description="ผู้ดูแลระบบยังไม่ได้ตั้งค่าความสำเร็จ" />
                    </Card>
                ) : (
                    // แสดงทุกระดับเป็นไกด์ให้เห็นภาพรวม — ที่ยังไม่ปลดล็อกทำให้จางลงแทนที่จะซ่อนไป
                    // เพื่อไม่ให้ดูเหมือนแถบ 0% ที่ท้อ แต่ยังบอกเป้าหมายที่เหลือให้เห็น
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {achievements.map((a) => (
                            <div
                                key={a.id}
                                className={cn(
                                    "bg-paper border border-line rounded-2xl p-3 text-center",
                                    a.unlocked ? "raise" : "border-dashed"
                                )}
                                title={a.description ?? undefined}
                            >
                                <AchievementIcon icon={a.icon} unlocked={a.unlocked} className="mx-auto" />
                                <span
                                    className={cn(
                                        "block text-[12px] font-medium mt-1.5 leading-tight line-clamp-2",
                                        !a.unlocked && "text-ink-mute"
                                    )}
                                >
                                    {a.name}
                                </span>
                                {a.unlocked && a.unlockedAt ? (
                                    <span className="block text-[11px] text-ink-mute mt-0.5 tnum">{formatDate(a.unlockedAt)}</span>
                                ) : (
                                    <span className="block text-[11px] text-ink-mute/70 mt-0.5 tnum">
                                        {formatNumber(a.threshold)} {ACHIEVEMENT_UNIT[a.type]}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* ───── ตั้งค่าบัญชี — แถวเดียวแบบหน้าตั้งค่าในแอป ───── */}
            <Card className="raise overflow-hidden">
                <SignOutButton className="w-full text-left px-4 sm:px-5 py-4 text-sm font-semibold text-danger hover:bg-paper-2 transition-colors" />
            </Card>
        </div>
    )
}

/** ตัวเลขหนึ่งช่องในการ์ดสรุป — ป้ายเล็กอยู่บน ตัวเลขอยู่ล่าง จัดกึ่งกลางคอลัมน์ */
function Metric({
    label, value, unit, href, small,
}: {
    label: string
    value: string
    unit?: string
    href?: string
    small?: boolean
}) {
    const inner = (
        <>
            <p className="eyebrow">{label}</p>
            <p className={cn("numeral mt-1", small ? "text-base" : "text-xl")}>
                {value}
                {unit && <span className="text-[0.55em] font-semibold tracking-normal text-ink-mute ml-1">{unit}</span>}
            </p>
        </>
    )

    const box = "px-2 py-3.5 text-center"
    if (href) {
        return (
            <Link href={href} className={cn(box, "block hover:bg-paper-2 transition-colors")}>
                {inner}
            </Link>
        )
    }
    return <div className={box}>{inner}</div>
}

/** กลุ่มการลงทะเบียนหนึ่งกลุ่ม — หัวกลุ่มอยู่บนสุดของการ์ด รายการเรียงเป็นแถวคั่นเส้น */
function RegGroup({
    title, regs, past,
}: {
    title: string
    regs: (Registration & { event: Event; category: { price: number } | null })[]
    past?: boolean
}) {
    return (
        <Card className="raise overflow-hidden">
            <p className="eyebrow px-4 sm:px-5 pt-3.5 pb-2.5">{title}</p>
            <ul className="divide-y divide-line border-t border-line">
                {regs.map((r) => <RegRow key={r.id} reg={r} past={past} />)}
            </ul>
        </Card>
    )
}

function RegRow({ reg, past }: { reg: Registration & { event: Event; category: { price: number } | null }; past?: boolean }) {
    const expired = isExpired(reg)
    const needsPayment = isAwaitingPayment(reg.status) && !past && !expired
    const isVirtual = reg.event.type === "VIRTUAL"
    const left = timeLeft(reg)

    return (
        <li className={cn("px-4 sm:px-5 py-3.5", past && "opacity-60")}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <Link
                        href={eventHref(reg.event)}
                        className="text-sm font-semibold tracking-tight hover:text-ink-soft transition-colors line-clamp-1"
                    >
                        {reg.event.title}
                    </Link>
                    <p className="text-[12px] text-ink-mute mt-0.5 tnum">
                        {isVirtual
                            ? `สะสมระยะ ${formatDateRange(reg.event.date, reg.event.endDate)}`
                            : `${formatDate(reg.event.date)} · ${formatTime(reg.event.date)}`}
                        {` · ${formatPrice(reg.category?.price ?? reg.event.price)}`}
                    </p>
                    {needsPayment && left !== null && (
                        <p className="text-[12px] text-danger mt-1 tnum">
                            เหลือเวลาชำระเงิน {formatTimeLeft(left)}
                        </p>
                    )}
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {/* แสดงสถานะจริง — หมดเวลาแล้วถือว่า EXPIRED แม้ยังไม่ถูกกวาดในฐานข้อมูล */}
                    <RegStatusBadge status={expired ? "EXPIRED" : reg.status} />
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
                    {reg.status === "PAID" && reg.receiptUrl && (
                        <ButtonLink href={reg.receiptUrl} target="_blank" size="sm" variant="ghost">
                            ใบเสร็จ
                        </ButtonLink>
                    )}
                </div>
            </div>
        </li>
    )
}

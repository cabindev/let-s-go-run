import { prisma } from "@/lib/prisma"
import { deleteAchievement } from "@/app/actions/admin"
import { ACHIEVEMENT_TYPE_LABEL, ACHIEVEMENT_UNIT } from "@/lib/achievements"
import { Card } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { AchievementIcon } from "@/components/ui/AchievementIcon"
import { AchievementForm } from "@/components/admin/AchievementForm"
import { ConfirmAction } from "@/components/ui/ConfirmAction"
import { formatNumber } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function AdminAchievementsPage() {
    const achievements = await prisma.achievement.findMany({
        orderBy: [{ type: "asc" }, { threshold: "asc" }],
        include: { _count: { select: { users: true } } },
    })

    return (
        <div className="space-y-10">
            <div>
                <p className="eyebrow">ปลดล็อกอัตโนมัติเมื่อผู้ใช้ถึงเกณฑ์</p>
                <h1 className="display text-3xl sm:text-4xl mt-2">ความสำเร็จ</h1>
            </div>

            <AchievementForm />

            {achievements.length === 0 ? (
                <Card>
                    <EmptyState title="ยังไม่มีความสำเร็จ" description="เพิ่มความสำเร็จด้านบนเพื่อให้ผู้ใช้มีเป้าหมายสะสม" />
                </Card>
            ) : (
                <ul className="divide-y divide-line">
                    {achievements.map((a) => (
                        <li key={a.id} className="flex items-center gap-4 py-4">
                            <AchievementIcon icon={a.icon} size="sm" />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold tracking-tight">{a.name}</p>
                                {a.description && <p className="text-[11px] text-ink-mute truncate">{a.description}</p>}
                                <p className="text-[11px] text-ink-mute mt-0.5 tnum">
                                    {ACHIEVEMENT_TYPE_LABEL[a.type]} ≥ {formatNumber(a.threshold, a.type === "TOTAL_DISTANCE" ? 1 : 0)} {ACHIEVEMENT_UNIT[a.type]}
                                    {" · "}ปลดล็อกแล้ว {a._count.users} คน
                                </p>
                            </div>
                            <ConfirmAction
                                action={deleteAchievement.bind(null, a.id)}
                                title="ลบความสำเร็จนี้?"
                                message={`"${a.name}" จะถูกลบ และผู้ใช้ ${a._count.users} คนที่ปลดล็อกไว้จะสูญเสียความสำเร็จนี้`}
                                confirmLabel="ลบ"
                                className="eyebrow text-ink-mute hover:text-danger transition-colors shrink-0"
                            >
                                ลบ
                            </ConfirmAction>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

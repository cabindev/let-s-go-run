import { prisma } from "@/lib/prisma"
import type { AchievementType } from "@prisma/client"

/** ค่าปัจจุบันของผู้ใช้ตามเกณฑ์แต่ละแบบ */
/**
 * จำนวนกิจกรรมที่ "จบแล้ว"
 * ONSITE  = เลยวันจัดงาน
 * VIRTUAL = สะสมระยะครบเป้าหมาย
 */
async function countCompletedEvents(userId: string, now: Date) {
    const regs = await prisma.registration.findMany({
        where: { userId, status: "PAID" },
        select: {
            event: { select: { date: true, distance: true, type: true } },
            category: { select: { distance: true } },
            submissions: { select: { distance: true } },
        },
    })

    return regs.filter((r) => {
        if (r.event.type === "VIRTUAL") {
            const target = r.category?.distance ?? r.event.distance
            const total = r.submissions.reduce((s, x) => s + x.distance, 0)
            return target > 0 && total >= target
        }
        return r.event.date < now
    }).length
}

export async function getProgressValues(userId: string) {
    const now = new Date()
    const [user, completedEvents] = await Promise.all([
        prisma.user.findUnique({
            where: { id: userId },
            select: { totalDistance: true },
        }),
        countCompletedEvents(userId, now),
    ])

    return {
        EVENT_COUNT: completedEvents,
        TOTAL_DISTANCE: user?.totalDistance ?? 0,
    } satisfies Record<AchievementType, number>
}

/** ปลดล็อกความสำเร็จที่ถึงเกณฑ์แล้ว คืนรายการที่เพิ่งปลดล็อก */
export async function unlockAchievements(userId: string) {
    const [achievements, owned, values] = await Promise.all([
        prisma.achievement.findMany(),
        prisma.userAchievement.findMany({ where: { userId }, select: { achievementId: true } }),
        getProgressValues(userId),
    ])

    const ownedIds = new Set(owned.map((o) => o.achievementId))
    const toUnlock = achievements.filter(
        (a) => !ownedIds.has(a.id) && values[a.type] >= a.threshold
    )

    if (toUnlock.length === 0) return []

    await prisma.userAchievement.createMany({
        data: toUnlock.map((a) => ({ userId, achievementId: a.id })),
        skipDuplicates: true,
    })

    return toUnlock
}

/** ความสำเร็จทั้งหมด พร้อมสถานะปลดล็อก + ความคืบหน้า สำหรับแสดงผล */
export async function getAchievementBoard(userId: string) {
    const [achievements, owned, values] = await Promise.all([
        prisma.achievement.findMany({ orderBy: [{ type: "asc" }, { threshold: "asc" }] }),
        prisma.userAchievement.findMany({ where: { userId } }),
        getProgressValues(userId),
    ])

    const ownedMap = new Map(owned.map((o) => [o.achievementId, o.unlockedAt]))

    return achievements.map((a) => {
        const value = values[a.type]
        return {
            ...a,
            unlocked: ownedMap.has(a.id),
            unlockedAt: ownedMap.get(a.id) ?? null,
            value,
            progress: Math.min(100, Math.round((value / a.threshold) * 100)),
        }
    })
}

export const ACHIEVEMENT_TYPE_LABEL: Record<AchievementType, string> = {
    EVENT_COUNT: "จำนวนกิจกรรมที่เข้าร่วม",
    TOTAL_DISTANCE: "ระยะทางสะสม (กม.)",
}

export const ACHIEVEMENT_UNIT: Record<AchievementType, string> = {
    EVENT_COUNT: "กิจกรรม",
    TOTAL_DISTANCE: "กม.",
}

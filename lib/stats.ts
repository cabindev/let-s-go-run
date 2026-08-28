import { prisma } from "@/lib/prisma"

/**
 * ระยะทางที่นับจริงของการลงทะเบียนหนึ่งรายการ — นับคนละแบบตามประเภทงาน
 *
 * ONSITE  : ได้ระยะของประเภทที่สมัคร เมื่อกิจกรรมจบไปแล้ว (ไม่ต้องส่งผล)
 * VIRTUAL : ได้เท่ากับผลรวมของผลวิ่งที่ส่งเข้ามาจริง (ไม่ผูกกับวันจบงาน)
 */
type Scored = {
    event: { distance: number; date: Date; type: "ONSITE" | "VIRTUAL" }
    category: { distance: number } | null
    submissions: { distance: number; runDate: Date }[]
}

const distanceOf = (r: Scored, now: Date) => {
    if (r.event.type === "VIRTUAL") {
        return r.submissions.reduce((s, x) => s + x.distance, 0)
    }
    return r.event.date < now ? (r.category?.distance ?? r.event.distance) : 0
}

/** ถือว่า "จบแล้ว" — onsite คือเลยวันงาน / virtual คือสะสมครบเป้าหมาย */
const isCompleted = (r: Scored, now: Date) => {
    if (r.event.type === "VIRTUAL") {
        const target = r.category?.distance ?? r.event.distance
        return target > 0 && distanceOf(r, now) >= target
    }
    return r.event.date < now
}

const SCORE_SELECT = {
    event: { select: { date: true, distance: true, type: true } },
    category: { select: { distance: true } },
    submissions: { select: { distance: true, runDate: true } },
} as const

/**
 * คำนวณสถิติผู้ใช้จากข้อมูลจริงในฐานข้อมูล
 * นับเฉพาะ registration ที่ status = PAID เท่านั้น
 */
export async function getUserStats(userId: string) {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const [user, paidRegs, upcomingCount, pendingCount] = await Promise.all([
        prisma.user.findUnique({
            where: { id: userId },
            select: { totalDistance: true },
        }),
        prisma.registration.findMany({
            where: { userId, status: "PAID" },
            select: SCORE_SELECT,
        }),
        prisma.registration.count({
            where: { userId, status: { in: ["PENDING", "WAITING", "PAID"] }, event: { date: { gte: now } } },
        }),
        prisma.registration.count({
            where: { userId, status: { in: ["PENDING", "WAITING"] } },
        }),
    ])

    // ระยะทางรวม — นับทุกรายการที่จ่ายแล้ว (VR ได้ตามผลที่ส่ง, onsite ได้เมื่อจบงาน)
    const totalDistance = paidRegs.reduce((s, r) => s + distanceOf(r, now), 0)
    const completed = paidRegs.filter((r) => isCompleted(r, now))

    // ระยะช่วงสัปดาห์/เดือน — onsite ยึดวันจัดงาน, virtual ยึดวันที่วิ่งของแต่ละผล
    const inRange = (r: (typeof paidRegs)[number], from: Date) =>
        r.event.type === "VIRTUAL"
            ? r.submissions.reduce((s, x) => s + (x.runDate >= from ? x.distance : 0), 0)
            : r.event.date >= from
                ? distanceOf(r, now)
                : 0

    const weekDistance = paidRegs.reduce((s, r) => s + inRange(r, startOfWeek), 0)
    const monthDistance = paidRegs.reduce((s, r) => s + inRange(r, startOfMonth), 0)
    const monthCompleted = completed.filter((r) => r.event.date >= startOfMonth)

    // อันดับ = จำนวนคนที่ระยะทางสะสมมากกว่าเรา + 1
    const rank = user
        ? (await prisma.user.count({ where: { totalDistance: { gt: totalDistance } } })) + 1
        : null

    return {
        // ใช้ค่าที่คำนวณสดเสมอ — คอลัมน์ User.totalDistance เป็นสำเนาไว้ให้กระดานอันดับเรียงลำดับ
        totalDistance,
        weekDistance,
        monthDistance,
        monthEvents: monthCompleted.length,
        completedEvents: completed.length,
        upcomingEvents: upcomingCount,
        pendingPayments: pendingCount,
        rank,
    }
}

/**
 * คำนวณ totalDistance ใหม่จาก registration ที่ PAID ทั้งหมด
 * เรียกทุกครั้งที่สถานะการชำระเงินเปลี่ยน เพื่อให้ตัวเลขตรงกับความจริงเสมอ
 */
export async function recalculateUserStats(userId: string) {
    const regs = await prisma.registration.findMany({
        where: { userId, status: "PAID" },
        select: SCORE_SELECT,
    })

    const now = new Date()
    const totalDistance = regs.reduce((s, r) => s + distanceOf(r, now), 0)

    await prisma.user.update({
        where: { id: userId },
        data: { totalDistance },
    })

    return { totalDistance }
}

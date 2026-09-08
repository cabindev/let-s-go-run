import { getSession } from "@/lib/auth-helpers"
import { getUserStats } from "@/lib/stats"
import { getLevel } from "@/lib/levels"

export interface UserSummary {
    totalDistance: number
    completedEvents: number
    levelName: string
    rank: number | null
    pendingPayments: number
}

/**
 * สถิติย่อของผู้ใช้ที่ล็อกอินอยู่ สำหรับเมนูผู้ใช้บนแถบบน (null ถ้ายังไม่ล็อกอิน)
 *
 * เรียกจาก layout ฝั่ง server แล้วส่งลงไปเป็น prop แบบเดียวกับ currentCartCount()
 * เพื่อให้ตัวเลขตรงกับฐานข้อมูลเสมอโดยไม่ต้องมี state ฝั่ง client
 * (ต้นทุนเท่าเดิมกับตอนที่แถบสถิติยังอยู่บนหน้าแรก — เรียก getUserStats ครั้งเดียวเหมือนกัน)
 */
export async function currentUserSummary(): Promise<UserSummary | null> {
    const session = await getSession()
    if (!session?.user) return null

    try {
        const stats = await getUserStats(session.user.id)
        return {
            totalDistance: stats.totalDistance,
            completedEvents: stats.completedEvents,
            levelName: getLevel(stats.totalDistance).current.name,
            rank: stats.rank,
            pendingPayments: stats.pendingPayments,
        }
    } catch {
        // สถิติคำนวณไม่ผ่านไม่ควรทำให้ทั้งแถบบนพัง — แค่ไม่โชว์ตัวเลข
        return null
    }
}

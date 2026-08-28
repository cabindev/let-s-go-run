/** ระดับสมาชิก คำนวณจากระยะทางสะสมจริง (กม.) ไม่ใช่ค่าคงที่ในฐานข้อมูล */
export const LEVELS = [
    { name: "Bronze", min: 0, icon: "🥉" },
    { name: "Silver", min: 50, icon: "🥈" },
    { name: "Gold", min: 150, icon: "🥇" },
    { name: "Platinum", min: 300, icon: "💎" },
    { name: "Diamond", min: 600, icon: "👑" },
] as const

export type Level = (typeof LEVELS)[number]

/** @param distance ระยะทางสะสมเป็นกิโลเมตร */
export function getLevel(distance: number) {
    let current: Level = LEVELS[0]
    for (const l of LEVELS) if (distance >= l.min) current = l
    const idx = LEVELS.indexOf(current as never)
    const next = idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null

    const progress = next
        ? Math.min(100, Math.round(((distance - current.min) / (next.min - current.min)) * 100))
        : 100

    return {
        current,
        next,
        progress,
        /** ระยะทางที่ยังขาดอยู่เพื่อเลื่อนระดับ (กม.) */
        distanceToNext: next ? Math.max(0, next.min - distance) : 0,
    }
}

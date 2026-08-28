/**
 * ข้อมูลตั้งต้นของระบบ — เฉพาะ "เกณฑ์ความสำเร็จ" ซึ่งเป็นค่าตั้งค่าของระบบ
 * ไม่ใช่ข้อมูลตัวอย่าง (กิจกรรม/ผู้ใช้ สร้างผ่านหน้าเว็บจริง)
 *
 * รัน: npx tsx prisma/seed.ts  หรือ  node --env-file=.env prisma/seed.mjs
 */
import { PrismaClient, AchievementType } from "@prisma/client"

const prisma = new PrismaClient()

const ACHIEVEMENTS: {
    name: string
    description: string
    icon: string
    type: AchievementType
    threshold: number
}[] = [
        { name: "ก้าวแรก", description: "เข้าร่วมกิจกรรมแรกสำเร็จ", icon: "⭐", type: "EVENT_COUNT", threshold: 1 },
        { name: "นักวิ่งประจำ", description: "เข้าร่วมครบ 5 กิจกรรม", icon: "🏃", type: "EVENT_COUNT", threshold: 5 },
        { name: "ขาประจำตัวจริง", description: "เข้าร่วมครบ 10 กิจกรรม", icon: "🔥", type: "EVENT_COUNT", threshold: 10 },
        { name: "25 กิจกรรม", description: "เข้าร่วมครบ 25 กิจกรรม", icon: "🎖️", type: "EVENT_COUNT", threshold: 25 },

        { name: "10 กิโลเมตรแรก", description: "สะสมระยะทางครบ 10 กม.", icon: "👟", type: "TOTAL_DISTANCE", threshold: 10 },
        { name: "ครึ่งร้อย", description: "สะสมระยะทางครบ 50 กม.", icon: "🌄", type: "TOTAL_DISTANCE", threshold: 50 },
        { name: "ร้อยกิโล", description: "สะสมระยะทางครบ 100 กม.", icon: "💯", type: "TOTAL_DISTANCE", threshold: 100 },
        { name: "500 กิโลเมตร", description: "สะสมระยะทางครบ 500 กม.", icon: "🗺️", type: "TOTAL_DISTANCE", threshold: 500 },
        { name: "หนึ่งพันกิโล", description: "สะสมระยะทางครบ 1,000 กม.", icon: "👑", type: "TOTAL_DISTANCE", threshold: 1000 },
    ]

async function main() {
    let created = 0
    for (const a of ACHIEVEMENTS) {
        const exists = await prisma.achievement.findFirst({
            where: { type: a.type, threshold: a.threshold },
        })
        if (exists) continue
        await prisma.achievement.create({ data: a })
        created++
    }
    console.log(`เพิ่มความสำเร็จใหม่ ${created} รายการ (ทั้งหมด ${await prisma.achievement.count()} รายการ)`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())

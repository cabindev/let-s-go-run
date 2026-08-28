import { NextResponse, type NextRequest } from "next/server"
import { expireStaleRegistrations } from "@/lib/expiry"

/**
 * ปล่อยที่นั่งของรายการที่ไม่ชำระเงินตามกำหนด
 *
 * ระบบไม่ได้พึ่ง endpoint นี้ในการนับที่นั่ง — การนับใช้ expiresAt โดยตรงอยู่แล้ว
 * ตัวนี้มีไว้เพื่อ "กวาดสถานะ" ให้หลังบ้านเห็นตรงกับความจริง
 *
 * ตั้ง CRON_SECRET ใน .env แล้วเรียกด้วย:
 *   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/expire
 */
export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET

    if (secret) {
        const auth = request.headers.get("authorization")
        if (auth !== `Bearer ${secret}`) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 })
        }
    }

    const expired = await expireStaleRegistrations()
    return NextResponse.json({ expired, at: new Date().toISOString() })
}

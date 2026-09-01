import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * API สำหรับระบบสแกน QR หน้างาน (โปรเจกต์แยก "ludtong-checkin") — ใช้ยืนยันการรับเสื้อ/ของที่ระลึก
 * QR ที่ออกให้ผู้สมัครเข้ารหัสแค่ registrationId (id ของ Registration) เป็นข้อความล้วน
 *
 * ต้องตั้ง CHECKIN_API_SECRET ใน .env แล้วเรียกด้วย:
 *   curl -H "Authorization: Bearer $CHECKIN_API_SECRET" http://localhost:3000/api/checkin/<registrationId>
 */
function checkAuth(request: NextRequest): boolean {
    const secret = process.env.CHECKIN_API_SECRET
    if (!secret) return false // ไม่ตั้งค่า = ปิดใช้งาน endpoint นี้ทั้งหมด (ปลอดภัยไว้ก่อน)
    return request.headers.get("authorization") === `Bearer ${secret}`
}

function serialize(reg: {
    id: string
    fullName: string | null
    bib: string | null
    shirtSize: string | null
    status: string
    pickupStatus: string
    pickupAt: Date | null
    shippingTrackingNo: string | null
    event: { title: string }
    category: { name: string; distance: number } | null
}) {
    return {
        id: reg.id,
        fullName: reg.fullName,
        bib: reg.bib,
        shirtSize: reg.shirtSize,
        registrationStatus: reg.status,
        eventTitle: reg.event.title,
        categoryName: reg.category ? `${reg.category.name} (${reg.category.distance} กม.)` : null,
        pickupStatus: reg.pickupStatus,
        pickupAt: reg.pickupAt?.toISOString() ?? null,
        shippingTrackingNo: reg.shippingTrackingNo,
    }
}

/** ดึงข้อมูลผู้สมัครจาก registrationId ที่สแกนได้ */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!checkAuth(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { id } = await params
    const reg = await prisma.registration.findUnique({
        where: { id },
        include: { event: { select: { title: true } }, category: { select: { name: true, distance: true } } },
    })
    if (!reg) return NextResponse.json({ error: "ไม่พบรายการลงทะเบียนนี้" }, { status: 404 })

    return NextResponse.json(serialize(reg))
}

/** ยืนยันรับเสื้อที่บูธ หรือบันทึกว่าส่งไปรษณีย์แทน */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!checkAuth(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await request.json().catch(() => null) as { method?: string; trackingNo?: string } | null
    if (body?.method !== "PICKED_UP" && body?.method !== "SHIPPED") {
        return NextResponse.json({ error: "method ต้องเป็น PICKED_UP หรือ SHIPPED" }, { status: 400 })
    }

    const reg = await prisma.registration.findUnique({
        where: { id },
        select: { status: true },
    })
    if (!reg) return NextResponse.json({ error: "ไม่พบรายการลงทะเบียนนี้" }, { status: 404 })
    if (reg.status !== "PAID") {
        return NextResponse.json({ error: "รายการนี้ยังไม่ยืนยันการชำระเงิน" }, { status: 400 })
    }

    const updated = await prisma.registration.update({
        where: { id },
        data: {
            pickupStatus: body.method,
            pickupAt: new Date(),
            shippingTrackingNo: body.method === "SHIPPED" ? (body.trackingNo || null) : null,
        },
        include: { event: { select: { title: true } }, category: { select: { name: true, distance: true } } },
    })

    return NextResponse.json(serialize(updated))
}

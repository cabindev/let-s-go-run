import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth-helpers"
import { buildRegistrationWhere } from "@/lib/admin-registrations-query"
import { REG_STATUS } from "@/components/ui/Badge"
import { GENDER_OPTIONS, registrationAmount } from "@/lib/events"

export const dynamic = "force-dynamic"

const PAYMENT_METHOD_LABEL: Record<string, string> = {
    card: "บัตรเครดิต/เดบิต",
    promptpay: "PromptPay",
}

const PICKUP_STATUS_LABEL: Record<string, string> = {
    PENDING: "ยังไม่รับ",
    PICKED_UP: "รับที่บูธแล้ว",
    SHIPPED: "ส่งไปรษณีย์แล้ว",
}

export async function GET(request: NextRequest) {
    const session = await getSession()
    if (!session?.user || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403 })
    }

    const { searchParams, origin: requestOrigin } = new URL(request.url)
    const origin = process.env.NEXTAUTH_URL || requestOrigin
    const where = buildRegistrationWhere({
        status: searchParams.get("status") ?? undefined,
        event: searchParams.get("event") ?? undefined,
        q: searchParams.get("q") ?? undefined,
    })

    const registrations = await prisma.registration.findMany({
        where,
        orderBy: [{ event: { date: "desc" } }, { registeredAt: "desc" }],
        include: {
            user: { select: { name: true, email: true, dateOfBirth: true } },
            event: { select: { title: true, price: true } },
            category: { select: { name: true, price: true, distance: true } },
        },
    })

    const workbook = new ExcelJS.Workbook()
    workbook.creator = "RunLudtong"
    workbook.created = new Date()

    const sheet = workbook.addWorksheet("รายการลงทะเบียน", {
        views: [{ state: "frozen", ySplit: 1 }],
    })

    sheet.columns = [
        { header: "ชื่อ-นามสกุล", key: "fullName", width: 28 },
        { header: "อีเมล", key: "email", width: 28 },
        { header: "เบอร์โทร", key: "phone", width: 16 },
        { header: "BIB", key: "bib", width: 10 },
        { header: "งาน", key: "event", width: 34 },
        { header: "ประเภท/ระยะ", key: "category", width: 22 },
        { header: "สถานะ", key: "status", width: 14 },
        { header: "ยอดชำระ", key: "amount", width: 12 },
        { header: "วิธีจ่าย", key: "paymentMethod", width: 14 },
        { header: "ไซส์เสื้อ", key: "shirtSize", width: 10 },
        { header: "วิธีรับของ", key: "deliveryMethod", width: 14 },
        { header: "ที่อยู่", key: "address", width: 36 },
        { header: "ผู้ติดต่อฉุกเฉิน", key: "emergencyName", width: 20 },
        { header: "เบอร์ฉุกเฉิน", key: "emergencyPhone", width: 16 },
        { header: "เพศ", key: "gender", width: 12 },
        { header: "วันเกิด", key: "dateOfBirth", width: 14 },
        { header: "กรุ๊ปเลือด", key: "bloodType", width: 12 },
        { header: "โรคประจำตัว", key: "medicalCondition", width: 24 },
        { header: "เลขบัตรประชาชน", key: "nationalId", width: 18 },
        { header: "เคยเข้าร่วมมาก่อน", key: "hasParticipatedBefore", width: 16 },
        { header: "ยินยอม PDPA เมื่อ", key: "pdpaConsentAt", width: 18 },
        { header: "สถานะรับเสื้อ", key: "pickupStatus", width: 14 },
        { header: "เลขพัสดุ", key: "shippingTrackingNo", width: 18 },
        { header: "ลายเซ็นผู้รับ", key: "pickupSignature", width: 16 },
        { header: "วันที่รับ/ส่ง", key: "pickupAt", width: 18 },
        { header: "วันที่สมัคร", key: "registeredAt", width: 18 },
        { header: "วันที่ชำระ", key: "paidAt", width: 18 },
    ]

    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A0A0A" } }
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
    })

    for (const r of registrations) {
        sheet.addRow({
            fullName: r.fullName || r.user.name || "",
            email: r.user.email,
            phone: r.phone || "",
            bib: r.bib || "",
            event: r.event.title,
            category: r.category ? `${r.category.name} (${r.category.distance} กม.)` : "",
            status: REG_STATUS[r.status]?.label ?? r.status,
            amount: registrationAmount(r.category?.price ?? r.event.price, r.deliveryMethod),
            paymentMethod: r.paymentMethod ? (PAYMENT_METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod) : "",
            shirtSize: r.shirtSize || "",
            deliveryMethod: r.deliveryMethod === "SHIPPING" ? "ส่งไปรษณีย์" : r.deliveryMethod === "PICKUP" ? "รับที่งาน" : "",
            address: r.address || "",
            emergencyName: r.emergencyName || "",
            emergencyPhone: r.emergencyPhone || "",
            gender: r.gender ? (GENDER_OPTIONS.find((g) => g.value === r.gender)?.label ?? r.gender) : "",
            dateOfBirth: r.user.dateOfBirth ?? null,
            bloodType: r.bloodType || "",
            medicalCondition: r.hasMedicalCondition === null ? "" : r.hasMedicalCondition ? (r.medicalConditionDetail || "มี") : "ไม่มี",
            nationalId: r.nationalId || "",
            hasParticipatedBefore: r.hasParticipatedBefore === null ? "" : r.hasParticipatedBefore ? "เคย" : "ไม่เคย",
            pdpaConsentAt: r.pdpaConsentAt ?? null,
            pickupStatus: PICKUP_STATUS_LABEL[r.pickupStatus],
            shippingTrackingNo: r.shippingTrackingNo || "",
            pickupSignature: r.pickupSignatureUrl
                ? { text: "ดูลายเซ็น", hyperlink: `${origin}${r.pickupSignatureUrl}` }
                : "",
            pickupAt: r.pickupAt ?? null,
            registeredAt: r.registeredAt,
            paidAt: r.paidAt ?? null,
        })
    }

    sheet.getColumn("dateOfBirth").numFmt = "yyyy-mm-dd"
    sheet.getColumn("nationalId").numFmt = "@"
    sheet.getColumn("amount").numFmt = "#,##0"
    sheet.getColumn("registeredAt").numFmt = "yyyy-mm-dd hh:mm"
    sheet.getColumn("paidAt").numFmt = "yyyy-mm-dd hh:mm"
    sheet.getColumn("pdpaConsentAt").numFmt = "yyyy-mm-dd hh:mm"
    sheet.getColumn("pickupAt").numFmt = "yyyy-mm-dd hh:mm"
    sheet.getColumn("pickupSignature").font = { color: { argb: "FF1D4ED8" }, underline: true }

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `registrations-${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${filename}"`,
        },
    })
}

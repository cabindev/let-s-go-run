import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth-helpers"
import { inviteSeatWhere } from "@/lib/expiry"
import { discountLabel } from "@/lib/invite-codes"

export const dynamic = "force-dynamic"

/**
 * ไฟล์ Excel โควตาสิทธิพิเศษของงานหนึ่ง — ไว้ส่งให้เจ้าหน้าที่สปอนเซอร์ตรวจ
 *
 * หนึ่งแถวคือหนึ่งโค้ด ไม่ใช่หนึ่งคน เพราะสิ่งที่สปอนเซอร์ต้องตรวจคือ
 * "สิทธิ์ที่ให้ไป 20 ใบ ใครใช้ไปแล้วบ้าง ใบไหนยังว่าง" — โค้ดที่ยังไม่มีคนใช้จึงต้องอยู่ในไฟล์ด้วย
 *
 * กรองด้วย ?event=<id> ได้ และเลือกเฉพาะกลุ่มด้วย &group=<ชื่อกลุ่ม>
 */
export async function GET(request: NextRequest) {
    const session = await getSession()
    if (!session?.user || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event") ?? undefined
    const group = searchParams.get("group") ?? undefined

    const codes = await prisma.inviteCode.findMany({
        where: { ...(eventId ? { eventId } : {}), ...(group ? { groupName: group } : {}) },
        orderBy: [{ event: { date: "desc" } }, { groupName: "asc" }, { createdAt: "asc" }],
        include: { event: { select: { id: true, title: true, date: true } } },
    })

    // ดึงผู้ใช้สิทธิ์ทั้งหมดทีเดียวแล้วจับคู่ในหน่วยความจำ — เลี่ยง query ต่อโค้ด (อาจมีหลายร้อยใบ)
    const regs = await prisma.registration.findMany({
        where: {
            inviteCodeId: { in: codes.map((c) => c.id) },
            ...inviteSeatWhere(),
        },
        orderBy: { registeredAt: "asc" },
        select: {
            inviteCodeId: true,
            fullName: true,
            phone: true,
            shirtSize: true,
            bib: true,
            status: true,
            registeredAt: true,
            category: { select: { name: true, distance: true } },
            user: { select: { name: true, email: true } },
        },
    })

    const byCode = new Map<string, typeof regs>()
    for (const r of regs) {
        const list = byCode.get(r.inviteCodeId!) ?? []
        list.push(r)
        byCode.set(r.inviteCodeId!, list)
    }

    const workbook = new ExcelJS.Workbook()
    workbook.creator = "RunLudtong"
    workbook.created = new Date()

    const sheet = workbook.addWorksheet("สิทธิพิเศษ", { views: [{ state: "frozen", ySplit: 1 }] })

    sheet.columns = [
        { header: "กลุ่ม", key: "groupName", width: 24 },
        { header: "รหัส", key: "code", width: 14 },
        { header: "สถานะ", key: "state", width: 14 },
        { header: "ใช้ไป/สิทธิ์", key: "usage", width: 12 },
        { header: "ชื่อ-นามสกุล", key: "fullName", width: 28 },
        { header: "เบอร์โทร", key: "phone", width: 16 },
        { header: "BIB", key: "bib", width: 10 },
        { header: "ประเภท/ระยะ", key: "category", width: 22 },
        { header: "ไซส์เสื้อ", key: "shirtSize", width: 10 },
        { header: "อีเมล", key: "email", width: 28 },
        { header: "วันที่ใช้สิทธิ์", key: "registeredAt", width: 18 },
        { header: "ส่วนลด", key: "discount", width: 16 },
        { header: "วันหมดอายุ", key: "expiresAt", width: 14 },
        { header: "งาน", key: "event", width: 32 },
        { header: "บันทึกภายใน", key: "note", width: 30 },
    ]

    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A0A0A" } }
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
    })

    for (const c of codes) {
        const users = byCode.get(c.id) ?? []
        const state = !c.active
            ? "ปิดใช้งาน"
            : c.expiresAt && c.expiresAt <= new Date()
                ? "หมดอายุ"
                : c.usedCount >= c.maxUses
                    ? "ใช้ครบแล้ว"
                    : "ยังว่าง"

        const base = {
            groupName: c.groupName,
            code: c.code,
            state,
            usage: `${c.usedCount}/${c.maxUses}`,
            discount: discountLabel(c.discountPercent),
            expiresAt: c.expiresAt ?? null,
            event: c.event.title,
            note: c.note ?? "",
        }

        // โค้ดที่ยังไม่มีใครใช้ต้องขึ้นเป็นแถวว่างไว้ ไม่ใช่หายไปจากไฟล์ —
        // สปอนเซอร์ต้องเห็นว่าเหลือสิทธิ์ที่ยังไม่ได้ใช้อยู่กี่ใบ
        if (users.length === 0) {
            sheet.addRow(base)
            continue
        }

        for (const u of users) {
            sheet.addRow({
                ...base,
                fullName: u.fullName || u.user.name || "",
                phone: u.phone || "",
                bib: u.bib || "",
                category: u.category ? `${u.category.name} (${u.category.distance} กม.)` : "",
                shirtSize: u.shirtSize || "",
                email: u.user.email ?? "",
                registeredAt: u.registeredAt,
            })
        }
    }

    // เบอร์โทรกับ BIB ต้องเป็นข้อความ ไม่งั้น Excel ตัด 0 ตัวหน้าทิ้ง (0812345678 → 812345678)
    sheet.getColumn("phone").numFmt = "@"
    sheet.getColumn("bib").numFmt = "@"
    sheet.getColumn("registeredAt").numFmt = "yyyy-mm-dd hh:mm"
    sheet.getColumn("expiresAt").numFmt = "yyyy-mm-dd"

    const buffer = await workbook.xlsx.writeBuffer()
    const slug = group ? `-${group.replace(/[^\p{L}\p{N}]+/gu, "-")}` : ""
    const filename = `invite-codes${slug}-${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        },
    })
}

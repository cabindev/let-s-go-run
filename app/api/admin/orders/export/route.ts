import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth-helpers"
import { buildOrderWhere } from "@/lib/shop-order-query"
import { DELIVERY_LABEL, ORDER_STATUS, PRODUCT_TYPE_LABEL } from "@/lib/shop"

export const dynamic = "force-dynamic"

const PAYMENT_METHOD_LABEL: Record<string, string> = {
    card: "บัตรเครดิต/เดบิต",
    promptpay: "PromptPay",
}

/**
 * ส่งออกออเดอร์ร้านค้าเป็น Excel — หนึ่งแถวต่อ "หนึ่งรายการสินค้า" ไม่ใช่ต่อออเดอร์
 * เพราะคนแพ็กของต้องเห็นว่าต้องหยิบไซส์ไหนกี่ตัว ส่วนยอดเงินของออเดอร์จะซ้ำในทุกแถวของใบเดียวกัน
 */
export async function GET(request: NextRequest) {
    const session = await getSession()
    if (!session?.user || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const where = buildOrderWhere({
        status: searchParams.get("status") ?? undefined,
        type: searchParams.get("type") ?? undefined,
        q: searchParams.get("q") ?? undefined,
    })

    const orders = await prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
            user: { select: { name: true, email: true } },
            items: true,
        },
    })

    const workbook = new ExcelJS.Workbook()
    workbook.creator = "RunLudtong"
    workbook.created = new Date()

    const sheet = workbook.addWorksheet("ออเดอร์ร้านค้า", {
        views: [{ state: "frozen", ySplit: 1 }],
    })

    sheet.columns = [
        { header: "เลขที่ออเดอร์", key: "orderNo", width: 18 },
        { header: "สถานะ", key: "status", width: 16 },
        { header: "ประเภท", key: "type", width: 12 },
        { header: "สินค้า", key: "productName", width: 32 },
        { header: "ตัวเลือก", key: "variantName", width: 22 },
        { header: "ราคา/ชิ้น", key: "unitPrice", width: 12 },
        { header: "จำนวน", key: "quantity", width: 10 },
        { header: "รวมรายการ", key: "lineTotal", width: 12 },
        { header: "ผู้สั่งซื้อ", key: "buyer", width: 24 },
        { header: "อีเมล", key: "email", width: 28 },
        { header: "วิธีรับของ", key: "deliveryMethod", width: 14 },
        { header: "ชื่อผู้รับ", key: "recipientName", width: 24 },
        { header: "เบอร์ผู้รับ", key: "recipientPhone", width: 16 },
        { header: "ที่อยู่", key: "address", width: 40 },
        { header: "จังหวัด", key: "province", width: 16 },
        { header: "รหัสไปรษณีย์", key: "postalCode", width: 14 },
        { header: "เลขพัสดุ", key: "trackingNo", width: 20 },
        { header: "ยอดสินค้า (ทั้งใบ)", key: "subtotal", width: 16 },
        { header: "ค่าจัดส่ง (ทั้งใบ)", key: "shippingFee", width: 16 },
        { header: "ยอดรวม (ทั้งใบ)", key: "total", width: 16 },
        { header: "วิธีจ่าย", key: "paymentMethod", width: 16 },
        { header: "หมายเหตุผู้ซื้อ", key: "customerNote", width: 28 },
        { header: "บันทึกภายใน", key: "adminNote", width: 28 },
        { header: "วันที่สั่ง", key: "createdAt", width: 18 },
        { header: "วันที่ชำระ", key: "paidAt", width: 18 },
        { header: "วันที่ส่ง", key: "shippedAt", width: 18 },
    ]

    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A0A0A" } }
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
    })

    for (const o of orders) {
        for (const [index, item] of o.items.entries()) {
            const first = index === 0
            sheet.addRow({
                orderNo: o.orderNo,
                status: ORDER_STATUS[o.status]?.label ?? o.status,
                type: PRODUCT_TYPE_LABEL[o.type],
                productName: item.productName,
                variantName: item.variantName,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                lineTotal: item.lineTotal,
                buyer: o.user.name || "",
                email: o.user.email,
                deliveryMethod: DELIVERY_LABEL[o.deliveryMethod],
                recipientName: o.recipientName || "",
                recipientPhone: o.recipientPhone || "",
                address: o.address || "",
                province: o.province || "",
                postalCode: o.postalCode || "",
                trackingNo: o.trackingNo || "",
                // ยอดระดับออเดอร์ใส่เฉพาะแถวแรกของใบ กันเผลอเอาไปบวกรวมซ้ำตอนทำสรุปยอด
                subtotal: first ? o.subtotal : null,
                shippingFee: first ? o.shippingFee : null,
                total: first ? o.total : null,
                paymentMethod: o.paymentMethod ? (PAYMENT_METHOD_LABEL[o.paymentMethod] ?? o.paymentMethod) : "",
                customerNote: first ? o.customerNote || "" : "",
                adminNote: first ? o.adminNote || "" : "",
                createdAt: o.createdAt,
                paidAt: o.paidAt ?? null,
                shippedAt: o.shippedAt ?? null,
            })
        }
    }

    for (const key of ["unitPrice", "lineTotal", "subtotal", "shippingFee", "total"]) {
        sheet.getColumn(key).numFmt = "#,##0.00"
    }
    sheet.getColumn("quantity").numFmt = "#,##0"
    sheet.getColumn("postalCode").numFmt = "@"
    for (const key of ["createdAt", "paidAt", "shippedAt"]) {
        sheet.getColumn(key).numFmt = "yyyy-mm-dd hh:mm"
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `orders-${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${filename}"`,
        },
    })
}

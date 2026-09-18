import { prisma } from "@/lib/prisma"
import { registrationBreakdown } from "@/lib/events"

/**
 * ออเดอร์ที่นับเป็นรายได้ — จ่ายเงินแล้วและยังไม่ถูกคืนเงิน
 *
 * PENDING ยังไม่ได้จ่าย · EXPIRED/CANCELLED คืนสต็อกไปแล้ว · REFUNDED คืนเงินไปแล้ว
 * ที่เหลือ (PAID → PREPARING → SHIPPED → COMPLETED) คือเงินที่เข้ากระเป๋าจริง
 */
const EARNING_ORDER_STATUS = ["PAID", "PREPARING", "SHIPPED", "COMPLETED"] as const

export interface EventRevenue {
    eventId: string
    title: string
    date: Date
    /** จ่ายเต็มราคา ไม่ได้ใช้โค้ด */
    regularCount: number
    regularEntry: number
    /** ใช้โค้ดแล้วยังจ่ายบางส่วน (โค้ดลด 10-50%) */
    discountedCount: number
    discountedEntry: number
    /** ใช้โค้ดแล้วไม่ต้องจ่ายเลย (โค้ดลด 100%) */
    freeCount: number
    /** ค่าส่งไปรษณีย์ที่เก็บมา — ไม่ใช่รายได้ ต้องจ่ายไปรษณีย์ต่อ */
    shipping: number
    /** มูลค่าส่วนลดที่ยกให้ไปทั้งหมด — ไม่ใช่รายได้ แต่เป็นตัวเลขที่สปอนเซอร์ขอ */
    grantedValue: number
    /** แยกมูลค่าสิทธิ์ตามกลุ่มที่ออกโค้ด */
    grantedByGroup: { groupName: string; count: number; value: number }[]
    /** รวมเงินที่เก็บได้จริงจากค่าสมัคร (ไม่รวมค่าส่ง) */
    entryTotal: number
}

export interface ProductRevenue {
    /** รหัสสินค้า — ยึด slug ที่ snapshot ไว้ ถ้าเป็นรายการเก่าก่อนมีฟิลด์นี้ค่อยใช้ชื่อแทน */
    key: string
    name: string
    slug: string | null
    quantity: number
    revenue: number
    /** แยกรายไซส์/ตัวเลือก เรียงจากขายดีสุด */
    variants: { name: string; sku: string | null; quantity: number; revenue: number }[]
}

export interface RevenueReport {
    events: EventRevenue[]
    products: ProductRevenue[]
    /** ค่าส่งของออเดอร์ร้านค้า — แยกจากรายได้เช่นเดียวกับฝั่งค่าสมัคร */
    shopShipping: number
    entryTotal: number
    productTotal: number
    shippingTotal: number
    grantedTotal: number
    /** มีใบสมัครที่จ่ายก่อนระบบเริ่มเก็บยอดจริงกี่ใบ — ตัวเลขของใบพวกนี้เป็นการคำนวณย้อนหลัง */
    estimatedRegistrations: number
}

/**
 * สรุปรายได้ทั้งระบบ แยกตามงาน (ค่าสมัคร) และตามสินค้า (ร้านค้า)
 *
 * ค่าสมัครผูกกับงานเสมอ ส่วนสินค้าไม่ผูก — ขายได้ตลอดไม่ขึ้นกับว่ามีงานหรือไม่
 * จึงสรุปคนละแกน ไม่ยัดยอดขายสินค้าเข้าไปในงานใดงานหนึ่ง
 *
 * ยอดค่าสมัครยึด paidEntry/paidShipping ที่บันทึกไว้ตอนจ่ายเงิน ใบเก่าที่จ่ายก่อนมีฟิลด์นี้
 * ถึงจะคำนวณย้อนหลังจากราคาปัจจุบันให้ และถูกนับไว้ใน estimatedRegistrations เพื่อให้
 * หน้าจอบอกผู้ใช้ได้ว่าส่วนไหนเป็นตัวเลขประมาณ
 */
export async function getRevenueReport(): Promise<RevenueReport> {
    const [registrations, orderItems, shopShippingAgg] = await Promise.all([
        prisma.registration.findMany({
            where: { status: "PAID" },
            select: {
                paidEntry: true,
                paidShipping: true,
                deliveryMethod: true,
                inviteCodeId: true,
                inviteGroupName: true,
                event: { select: { id: true, title: true, date: true, price: true } },
                category: { select: { price: true } },
                inviteCode: { select: { discountPercent: true } },
            },
        }),
        prisma.orderItem.findMany({
            where: { order: { status: { in: [...EARNING_ORDER_STATUS] } } },
            select: {
                productName: true,
                variantName: true,
                productSlug: true,
                variantSku: true,
                quantity: true,
                lineTotal: true,
            },
        }),
        prisma.order.aggregate({
            where: { status: { in: [...EARNING_ORDER_STATUS] } },
            _sum: { shippingFee: true },
        }),
    ])

    // ---------- ค่าสมัคร แยกตามงาน ----------
    const byEvent = new Map<string, EventRevenue>()
    const grants = new Map<string, Map<string, { count: number; value: number }>>()
    let estimatedRegistrations = 0

    for (const r of registrations) {
        const e = byEvent.get(r.event.id) ?? {
            eventId: r.event.id,
            title: r.event.title,
            date: r.event.date,
            regularCount: 0, regularEntry: 0,
            discountedCount: 0, discountedEntry: 0,
            freeCount: 0,
            shipping: 0, grantedValue: 0, grantedByGroup: [], entryTotal: 0,
        }

        // ราคาเต็มก่อนหักส่วนลด — ใช้คิดมูลค่าสิทธิ์ที่ยกให้ไป
        const fullPrice = r.category?.price ?? r.event.price

        let entry: number
        let shipping: number
        if (r.paidEntry !== null && r.paidShipping !== null) {
            entry = r.paidEntry
            shipping = r.paidShipping
        } else {
            // ใบเก่าก่อนมีฟิลด์ — คำนวณย้อนหลังให้ แล้วปักธงว่าเป็นตัวเลขประมาณ
            const b = registrationBreakdown(r)
            entry = b.entry
            shipping = b.shipping
            estimatedRegistrations++
        }

        if (!r.inviteCodeId) {
            e.regularCount++
            e.regularEntry += entry
        } else if (entry > 0) {
            e.discountedCount++
            e.discountedEntry += entry
        } else {
            e.freeCount++
        }

        e.shipping += shipping
        e.entryTotal += entry

        if (r.inviteCodeId) {
            const given = Math.max(0, fullPrice - entry)
            e.grantedValue += given
            const groupName = r.inviteGroupName ?? "ไม่ระบุกลุ่ม"
            const groups = grants.get(r.event.id) ?? new Map()
            const cur = groups.get(groupName) ?? { count: 0, value: 0 }
            groups.set(groupName, { count: cur.count + 1, value: cur.value + given })
            grants.set(r.event.id, groups)
        }

        byEvent.set(r.event.id, e)
    }

    for (const [eventId, groups] of grants) {
        const e = byEvent.get(eventId)
        if (!e) continue
        e.grantedByGroup = [...groups.entries()]
            .map(([groupName, v]) => ({ groupName, ...v }))
            .sort((a, b) => b.value - a.value)
    }

    const events = [...byEvent.values()].sort((a, b) => b.date.getTime() - a.date.getTime())

    // ---------- ร้านค้า แยกตามรหัสสินค้า ----------
    const byProduct = new Map<string, ProductRevenue>()
    for (const i of orderItems) {
        // ยึด slug ก่อนเสมอ ชื่อเปลี่ยนได้แต่ slug ไม่เปลี่ยน — รายการเก่าที่ไม่มี slug
        // ค่อยยึดชื่อแทน (จะแยกก้อนกับของใหม่ถ้าเคยเปลี่ยนชื่อ ซึ่งเลี่ยงไม่ได้แล้ว)
        const key = i.productSlug ?? `name:${i.productName}`
        const p = byProduct.get(key) ?? {
            key,
            name: i.productName,
            slug: i.productSlug,
            quantity: 0,
            revenue: 0,
            variants: [],
        }
        p.quantity += i.quantity
        p.revenue += i.lineTotal

        const v = p.variants.find((x) => x.name === i.variantName)
        if (v) {
            v.quantity += i.quantity
            v.revenue += i.lineTotal
        } else {
            p.variants.push({
                name: i.variantName,
                sku: i.variantSku,
                quantity: i.quantity,
                revenue: i.lineTotal,
            })
        }
        byProduct.set(key, p)
    }

    /*
     * ชื่อที่แสดงยึดชื่อปัจจุบันของสินค้า ไม่ใช่ชื่อที่ snapshot ไว้
     *
     * snapshot เก็บชื่อ ณ วันที่ขาย ซึ่งเป็นสิ่งที่ถูกสำหรับใบเสร็จ แต่ผิดสำหรับรายงาน —
     * สินค้าที่เคยเปลี่ยนชื่อจะถูกเรียกด้วยชื่อของรายการที่เจอก่อน กลายเป็นว่ารายงาน
     * ขึ้นชื่อเก่าอย่าง "TEST" ทั้งที่วันนี้สินค้าชื่อ "เสื้อรันลัดโต้ง ครั้งที่ 8" ไปแล้ว
     * (เจอกับของจริงบน production) สินค้าที่ถูกลบไปแล้วค่อยใช้ชื่อจาก snapshot ตามเดิม
     */
    const slugs = [...byProduct.values()].map((p) => p.slug).filter((s): s is string => !!s)
    if (slugs.length > 0) {
        const current = await prisma.product.findMany({
            where: { slug: { in: slugs } },
            select: { slug: true, name: true },
        })
        const nameBySlug = new Map(current.map((c) => [c.slug, c.name]))
        for (const p of byProduct.values()) {
            const name = p.slug ? nameBySlug.get(p.slug) : undefined
            if (name) p.name = name
        }
    }

    const products = [...byProduct.values()].sort((a, b) => b.revenue - a.revenue)
    for (const p of products) p.variants.sort((a, b) => b.quantity - a.quantity)

    const shopShipping = shopShippingAgg._sum.shippingFee ?? 0
    const entryTotal = events.reduce((s, e) => s + e.entryTotal, 0)
    const productTotal = products.reduce((s, p) => s + p.revenue, 0)

    return {
        events,
        products,
        shopShipping,
        entryTotal,
        productTotal,
        shippingTotal: events.reduce((s, e) => s + e.shipping, 0) + shopShipping,
        grantedTotal: events.reduce((s, e) => s + e.grantedValue, 0),
        estimatedRegistrations,
    }
}

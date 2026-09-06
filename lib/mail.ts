import nodemailer from "nodemailer"

/**
 * ตั้ง timeout ไว้ทุกชั้น เพราะ webhook ของ Stripe ส่งอีเมลอยู่ข้างในและมีเวลาตอบจำกัด ~10 วินาที
 * ค่า default ของ nodemailer รอเป็นนาที ถ้า SMTP ล่มจะลาก webhook ค้างจน Stripe ตัดแล้วรีทราย
 * (ถ้าโดนรีทรายบ่อย ๆ Stripe จะปิด endpoint ทิ้ง) — ยอมให้อีเมลไม่ออกดีกว่าให้ webhook พัง
 */
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
})

/** เพดานเวลารวมของการส่งหนึ่งฉบับ — กันกรณี SMTP ค้างแบบที่ timeout ด้านบนจับไม่ได้ */
const MAIL_DEADLINE_MS = 8000

function withDeadline<T>(task: Promise<T>, label: string): Promise<T | null> {
    return Promise.race([
        task,
        new Promise<null>((resolve) =>
            setTimeout(() => {
                console.error(`[mail] "${label}" ใช้เวลาเกิน ${MAIL_DEADLINE_MS}ms — ยกเลิกการรอ`)
                resolve(null)
            }, MAIL_DEADLINE_MS)
        ),
    ])
}

/** ยังไม่ได้ตั้งค่า SMTP = ข้ามการส่งไปเลย ไม่ใช่ล้มทั้งคำสั่งซื้อ */
export function isMailConfigured() {
    return !!(process.env.SMTP_USER && process.env.SMTP_PASSWORD)
}

/** ปลายทางแจ้งเตือนฝั่งร้าน — ไม่ได้ตั้งแยกก็ส่งเข้าบัญชีที่ใช้ส่งอีเมลนั่นแหละ */
function adminAddress() {
    return process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER || ""
}

function origin() {
    return process.env.NEXTAUTH_URL || "http://localhost:3000"
}

const INK = "#0A0A0A"
const INK_SOFT = "#3F3F46"
const INK_MUTE = "#71717A"
const LINE = "#DEDEE2"

/** โครงอีเมลกลาง — หัวจดหมายและฟุตเตอร์เหมือนกันทุกฉบับ */
function layout(title: string, body: string) {
    return `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: ${INK};">
            <p style="font-size: 20px; font-weight: 700; margin: 0 0 24px;">
                Run<span style="background:#FADF4B; padding: 0 4px; border-radius: 2px;">Ludtong</span>
            </p>
            <h1 style="font-size: 18px; margin: 0 0 16px;">${title}</h1>
            ${body}
            <p style="font-size: 12px; color: ${INK_MUTE}; line-height: 1.6; margin: 32px 0 0; border-top: 1px solid ${LINE}; padding-top: 16px;">
                อีเมลฉบับนี้ส่งอัตโนมัติจากระบบร้านค้ารันลัดโต้ง
            </p>
        </div>
    `
}

function button(href: string, label: string) {
    return `<a href="${href}" style="display:inline-block; background:${INK}; color:#ffffff; text-decoration:none;
            padding:12px 24px; border-radius:999px; font-size:14px; font-weight:600;">${label}</a>`
}

function paragraph(text: string) {
    return `<p style="font-size:14px; color:${INK_SOFT}; line-height:1.6; margin:0 0 16px;">${text}</p>`
}

/** ตารางสรุปรายการสินค้า + ยอดเงิน ใช้ซ้ำในอีเมลหลายฉบับ */
function orderTable(order: MailOrder) {
    const rows = order.items
        .map(
            (i) => `
            <tr>
                <td style="padding:8px 0; font-size:13px; color:${INK_SOFT};">
                    ${escapeHtml(i.productName)}<br>
                    <span style="color:${INK_MUTE};">${escapeHtml(i.variantName)} × ${i.quantity}</span>
                </td>
                <td style="padding:8px 0; font-size:13px; text-align:right; white-space:nowrap;">
                    ฿${i.lineTotal.toLocaleString("th-TH")}
                </td>
            </tr>`
        )
        .join("")

    return `
        <table style="width:100%; border-collapse:collapse; margin:0 0 16px;">
            ${rows}
            <tr><td colspan="2" style="border-top:1px solid ${LINE}; padding-top:8px;"></td></tr>
            <tr>
                <td style="font-size:13px; color:${INK_MUTE}; padding:2px 0;">ค่าจัดส่ง</td>
                <td style="font-size:13px; text-align:right;">฿${order.shippingFee.toLocaleString("th-TH")}</td>
            </tr>
            <tr>
                <td style="font-size:15px; font-weight:700; padding:4px 0;">ยอดรวม</td>
                <td style="font-size:15px; font-weight:700; text-align:right;">฿${order.total.toLocaleString("th-TH")}</td>
            </tr>
        </table>
    `
}

function escapeHtml(s: string) {
    return s.replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
    )
}

/**
 * ส่งอีเมลแบบ "ห้ามพัง" — อีเมลส่งไม่ออกต้องไม่ทำให้คำสั่งซื้อหรือ webhook ล้ม
 * คืน true/false ไว้ให้ผู้เรียกใช้ตรวจตอนทดสอบได้
 */
async function safeSend(to: string, subject: string, html: string) {
    if (!isMailConfigured()) {
        console.warn(`[mail] ยังไม่ได้ตั้งค่า SMTP — ข้ามการส่ง "${subject}" ถึง ${to}`)
        return false
    }
    if (!to) {
        console.warn(`[mail] ไม่มีอีเมลปลายทางสำหรับ "${subject}"`)
        return false
    }
    try {
        const sent = await withDeadline(
            transporter.sendMail({
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to,
                subject,
                html,
            }),
            subject
        )
        return sent !== null
    } catch (e) {
        console.error(`[mail] ส่ง "${subject}" ถึง ${to} ไม่สำเร็จ:`, e instanceof Error ? e.message : e)
        return false
    }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
    await safeSend(
        to,
        "ตั้งรหัสผ่านใหม่ · RunLudtong",
        layout(
            "ตั้งรหัสผ่านใหม่",
            paragraph(
                "มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีนี้ กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ ลิงก์นี้ใช้ได้ครั้งเดียวและหมดอายุใน 1 ชั่วโมง ถ้าคุณไม่ได้ขอ สามารถละเว้นอีเมลนี้ได้ รหัสผ่านเดิมจะยังใช้งานได้ตามปกติ"
            ) +
                button(resetUrl, "ตั้งรหัสผ่านใหม่") +
                `<p style="font-size:12px; color:${INK_MUTE}; line-height:1.6; margin:24px 0 0; word-break:break-all;">
                    หรือคัดลอกลิงก์นี้ไปวางในเบราว์เซอร์: ${resetUrl}
                </p>`
        )
    )
}

export interface MailOrder {
    id: string
    orderNo: string
    total: number
    shippingFee: number
    deliveryMethod: "PICKUP" | "SHIPPING"
    trackingNo?: string | null
    expiresAt?: Date | null
    items: { productName: string; variantName: string; quantity: number; lineTotal: number }[]
}

/**
 * ตัวประกอบเนื้อหาอีเมลแยกจากตัวส่ง — เพื่อให้ตรวจหน้าตาอีเมลได้โดยไม่ต้องส่งจริง
 * (ดูสคริปต์ตรวจ template ใน docs/production-migrations.md)
 */
export interface RenderedMail {
    subject: string
    html: string
}

/** สั่งซื้อสำเร็จ รอชำระเงิน */
export function renderOrderPlacedEmail(order: MailOrder): RenderedMail {
    const url = `${origin()}/orders/${order.id}`
    const deadline = order.expiresAt
        ? order.expiresAt.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })
        : null

    return {
        subject: `รับคำสั่งซื้อ ${order.orderNo} แล้ว · รอชำระเงิน`,
        html: layout(
            `รับคำสั่งซื้อ ${escapeHtml(order.orderNo)} แล้ว`,
            paragraph(
                deadline
                    ? `เรากันสินค้าไว้ให้แล้ว กรุณาชำระเงินภายใน <strong>${deadline}</strong> มิฉะนั้นระบบจะคืนสินค้าเข้าสต็อกโดยอัตโนมัติ`
                    : "เราได้รับคำสั่งซื้อของคุณแล้ว"
            ) +
                orderTable(order) +
                button(url, "ไปที่หน้าชำระเงิน")
        ),
    }
}

/** ชำระเงินสำเร็จ */
export function renderOrderPaidEmail(order: MailOrder, receiptUrl?: string | null): RenderedMail {
    const url = `${origin()}/orders/${order.id}`
    const next =
        order.deliveryMethod === "SHIPPING"
            ? "ทางร้านจะจัดส่งตามที่อยู่ที่แจ้งไว้ และจะแจ้งเลขพัสดุให้ทราบทางอีเมลอีกครั้ง"
            : "ติดต่อรับสินค้าได้ตามจุดนัดหมายของผู้จัด"

    return {
        subject: `ชำระเงินสำเร็จ · ${order.orderNo}`,
        html: layout(
            "ได้รับชำระเงินเรียบร้อยแล้ว",
            paragraph(`ขอบคุณสำหรับคำสั่งซื้อ <strong>${escapeHtml(order.orderNo)}</strong> — ${next}`) +
                orderTable(order) +
                button(url, "ดูคำสั่งซื้อ") +
                (receiptUrl
                    ? `<p style="font-size:13px; margin:16px 0 0;"><a href="${receiptUrl}" style="color:${INK_SOFT};">ดาวน์โหลดใบเสร็จจาก Stripe</a></p>`
                    : "")
        ),
    }
}

/** จัดส่งแล้ว */
export function renderOrderShippedEmail(order: MailOrder): RenderedMail {
    const url = `${origin()}/orders/${order.id}`
    return {
        subject: `จัดส่งแล้ว · ${order.orderNo}`,
        html: layout(
            "สินค้าของคุณจัดส่งแล้ว",
            paragraph(
                order.trackingNo
                    ? `คำสั่งซื้อ <strong>${escapeHtml(order.orderNo)}</strong> ถูกจัดส่งแล้ว เลขพัสดุ <strong>${escapeHtml(order.trackingNo)}</strong>`
                    : `คำสั่งซื้อ <strong>${escapeHtml(order.orderNo)}</strong> ถูกจัดส่งแล้ว`
            ) + button(url, "ดูคำสั่งซื้อ")
        ),
    }
}

export async function sendOrderPlacedEmail(to: string, order: MailOrder) {
    const m = renderOrderPlacedEmail(order)
    return safeSend(to, m.subject, m.html)
}

export async function sendOrderPaidEmail(to: string, order: MailOrder, receiptUrl?: string | null) {
    const m = renderOrderPaidEmail(order, receiptUrl)
    return safeSend(to, m.subject, m.html)
}

export async function sendOrderShippedEmail(to: string, order: MailOrder) {
    const m = renderOrderShippedEmail(order)
    return safeSend(to, m.subject, m.html)
}

/**
 * แจ้งเตือนฝั่งร้าน: เงินเข้าแล้วแต่ระบบรับออเดอร์ไม่ได้
 * เป็นเคสที่ลูกค้าเสียเงินแต่ไม่ได้ของ ต้องมีคนตามเรื่องเสมอ
 */
export async function sendPaymentIssueAlert(order: {
    id: string
    orderNo: string
    status: string
    total: number
    customerEmail: string
    paymentIntentId: string | null
}) {
    const url = `${origin()}/admin/orders/${order.id}`
    return safeSend(
        adminAddress(),
        `⚠ เงินเข้าแต่ออเดอร์ไม่สมบูรณ์ · ${order.orderNo}`,
        layout(
            "เงินเข้าแล้วแต่ระบบรับออเดอร์ไม่ได้",
            paragraph(
                `ออเดอร์ <strong>${escapeHtml(order.orderNo)}</strong> ถูกชำระเงินสำเร็จผ่าน Stripe
                 แต่ตอนที่เงินเข้า ออเดอร์อยู่ในสถานะ <strong>${escapeHtml(order.status)}</strong> แล้ว
                 (หมดเวลาชำระหรือถูกยกเลิกไปก่อน) สินค้าจึงถูกคืนเข้าสต็อกไปแล้ว`
            ) +
                paragraph(
                    `ยอดเงิน <strong>฿${order.total.toLocaleString("th-TH")}</strong> ·
                     ลูกค้า ${escapeHtml(order.customerEmail)} ·
                     Payment Intent <code>${escapeHtml(order.paymentIntentId ?? "—")}</code>`
                ) +
                paragraph("กรุณาตรวจสอบและตัดสินใจว่าจะคืนเงินหรือจัดส่งสินค้าให้ลูกค้า") +
                button(url, "เปิดออเดอร์นี้")
        )
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// ระบบสมัครงานวิ่ง — ใช้โครงจดหมายและกติกา "ห้ามพัง" ชุดเดียวกับฝั่งร้านค้า
// ─────────────────────────────────────────────────────────────────────────────

export interface MailRegistration {
    id: string
    eventTitle: string
    eventDate: Date
    categoryName: string | null
    amount: number
    bib?: string | null
    expiresAt?: Date | null
    deliveryMethod?: string | null
}

function registrationTable(reg: MailRegistration) {
    const rows: [string, string][] = [
        ["กิจกรรม", escapeHtml(reg.eventTitle)],
        ["วันจัดงาน", reg.eventDate.toLocaleDateString("th-TH", { dateStyle: "long" })],
    ]
    if (reg.categoryName) rows.push(["ประเภท", escapeHtml(reg.categoryName)])
    if (reg.bib) rows.push(["หมายเลข BIB", escapeHtml(reg.bib)])
    rows.push(["ยอดชำระ", `฿${reg.amount.toLocaleString("th-TH")}`])

    return `
        <table style="width:100%; border-collapse:collapse; margin:0 0 16px;">
            ${rows
                .map(
                    ([k, v], i) => `
                <tr>
                    <td style="padding:6px 0; font-size:13px; color:${INK_MUTE}; ${i === rows.length - 1 ? `border-top:1px solid ${LINE}; padding-top:10px;` : ""}">${k}</td>
                    <td style="padding:6px 0; font-size:13px; text-align:right; ${i === rows.length - 1 ? `border-top:1px solid ${LINE}; padding-top:10px; font-weight:700; font-size:15px;` : ""}">${v}</td>
                </tr>`
                )
                .join("")}
        </table>
    `
}

/** สมัครสำเร็จ รอชำระเงิน */
export async function sendRegistrationPlacedEmail(to: string, reg: MailRegistration) {
    const url = `${origin()}/payment/${reg.id}`
    const deadline = reg.expiresAt
        ? reg.expiresAt.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })
        : null

    return safeSend(
        to,
        `รับใบสมัครแล้ว · ${reg.eventTitle}`,
        layout(
            "รับใบสมัครของคุณแล้ว",
            paragraph(
                deadline
                    ? `เรากันที่นั่งไว้ให้แล้ว กรุณาชำระเงินภายใน <strong>${deadline}</strong> มิฉะนั้นระบบจะคืนที่นั่งให้ผู้สมัครคนอื่นโดยอัตโนมัติ`
                    : "ใบสมัครของคุณได้รับการบันทึกแล้ว"
            ) +
                registrationTable(reg) +
                button(url, "ไปที่หน้าชำระเงิน")
        )
    )
}

/** ยืนยันการสมัคร (ชำระเงินแล้ว หรือกิจกรรมฟรี) */
export async function sendRegistrationPaidEmail(
    to: string,
    reg: MailRegistration,
    receiptUrl?: string | null
) {
    const url = `${origin()}/payment/${reg.id}`
    const pickup =
        reg.deliveryMethod === "SHIPPING"
            ? "คุณเลือกรับของทางไปรษณีย์ — ไม่ต้องมาสแกนหน้างาน ทางผู้จัดจะจัดส่งให้ตามที่อยู่ที่แจ้งไว้"
            : "แสดง QR ในหน้าใบสมัครที่บูธรับเสื้อ/ของที่ระลึกหน้างาน"

    return safeSend(
        to,
        `ยืนยันการสมัครแล้ว · ${reg.eventTitle}`,
        layout(
            "ยืนยันการสมัครเรียบร้อยแล้ว",
            paragraph(`คุณเข้าร่วม <strong>${escapeHtml(reg.eventTitle)}</strong> เรียบร้อยแล้ว แล้วเจอกันที่จุดสตาร์ท`) +
                registrationTable(reg) +
                paragraph(pickup) +
                button(url, "ดูใบสมัครและ QR") +
                (receiptUrl
                    ? `<p style="font-size:13px; margin:16px 0 0;"><a href="${receiptUrl}" style="color:${INK_SOFT};">ดาวน์โหลดใบเสร็จจาก Stripe</a></p>`
                    : "")
        )
    )
}

/** แจ้งผู้จัดงาน: เงินเข้าแล้วแต่ใบสมัครหมดอายุ/ถูกยกเลิกไปก่อน */
export async function sendRegistrationIssueAlert(reg: {
    id: string
    eventTitle: string
    status: string
    amount: number
    customerEmail: string
    paymentIntentId: string | null
}) {
    return safeSend(
        adminAddress(),
        `⚠ เงินเข้าแต่ใบสมัครไม่สมบูรณ์ · ${reg.eventTitle}`,
        layout(
            "เงินเข้าแล้วแต่ระบบรับใบสมัครไม่ได้",
            paragraph(
                `มีผู้สมัคร <strong>${escapeHtml(reg.customerEmail)}</strong> ชำระเงินสำเร็จสำหรับงาน
                 <strong>${escapeHtml(reg.eventTitle)}</strong> แต่ตอนที่เงินเข้า ใบสมัครอยู่ในสถานะ
                 <strong>${escapeHtml(reg.status)}</strong> แล้ว (หมดเวลาชำระหรือถูกยกเลิกไปก่อน)
                 ที่นั่งจึงถูกคืนให้ผู้สมัครคนอื่นไปแล้ว`
            ) +
                paragraph(
                    `ยอดเงิน <strong>฿${reg.amount.toLocaleString("th-TH")}</strong> ·
                     Payment Intent <code>${escapeHtml(reg.paymentIntentId ?? "—")}</code>`
                ) +
                paragraph("กรุณาตรวจสอบและตัดสินใจว่าจะคืนเงินหรือคืนที่นั่งให้ผู้สมัคร") +
                button(`${origin()}/admin/registrations`, "เปิดหน้ารายการผู้สมัคร")
        )
    )
}

/** แจ้งผู้สมัครว่าจ่ายเงินแล้วแต่มีปัญหา ทีมงานจะติดต่อกลับ */
export async function sendRegistrationIssueCustomerEmail(to: string, eventTitle: string) {
    return safeSend(
        to,
        `เรากำลังตรวจสอบการสมัคร · ${eventTitle}`,
        layout(
            "เราได้รับเงินของคุณแล้ว แต่มีเรื่องต้องตรวจสอบ",
            paragraph(
                `การสมัครงาน <strong>${escapeHtml(eventTitle)}</strong> ชำระเงินสำเร็จ
                 แต่ระบบพบว่าใบสมัครหมดเวลาชำระหรือถูกยกเลิกไปก่อนที่การชำระเงินจะเข้ามา`
            ) +
                paragraph(
                    "ทีมงานได้รับแจ้งแล้วและจะติดต่อกลับโดยเร็วที่สุด เพื่อยืนยันว่าจะคืนที่นั่งให้ หรือคืนเงินให้เต็มจำนวน ขออภัยในความไม่สะดวก"
                )
        )
    )
}

/** แจ้งลูกค้าว่าจ่ายเงินแล้วแต่มีปัญหา ทีมงานจะติดต่อกลับ */
export async function sendPaymentIssueCustomerEmail(to: string, orderNo: string) {
    return safeSend(
        to,
        `เรากำลังตรวจสอบคำสั่งซื้อ ${orderNo}`,
        layout(
            "เราได้รับเงินของคุณแล้ว แต่มีเรื่องต้องตรวจสอบ",
            paragraph(
                `คำสั่งซื้อ <strong>${escapeHtml(orderNo)}</strong> ชำระเงินสำเร็จ
                 แต่ระบบพบว่าคำสั่งซื้อหมดเวลาชำระหรือถูกยกเลิกไปก่อนที่การชำระเงินจะเข้ามา`
            ) +
                paragraph(
                    "ทีมงานได้รับแจ้งแล้วและจะติดต่อกลับโดยเร็วที่สุด เพื่อยืนยันว่าจะจัดส่งสินค้าให้ หรือคืนเงินให้เต็มจำนวน ขออภัยในความไม่สะดวก"
                )
        )
    )
}

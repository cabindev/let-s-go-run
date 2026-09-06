import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Card } from "@/components/ui/Card"
import { Badge, Notice } from "@/components/ui/Badge"
import { OrderStatusEditor } from "@/components/admin/OrderStatusEditor"
import { DELIVERY_LABEL, ORDER_STATUS, PRODUCT_TYPE_LABEL, PRODUCT_TYPE_TONE } from "@/lib/shop"
import { formatBaht, formatDate, formatTime } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const order = await prisma.order.findUnique({
        where: { id },
        include: {
            user: { select: { name: true, email: true } },
            items: { include: { product: { select: { slug: true } } } },
        },
    })
    if (!order) notFound()

    const status = ORDER_STATUS[order.status]
    const itemCount = order.items.reduce((s, i) => s + i.quantity, 0)

    return (
        <div className="max-w-2xl mx-auto space-y-10">
            <div>
                <Link
                    href="/admin/orders"
                    className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                    ออเดอร์ร้านค้า
                </Link>

                <div className="flex flex-wrap items-end justify-between gap-4 mt-4">
                    <div>
                        <p className="eyebrow tnum">{order.orderNo}</p>
                        <h1 className="display text-2xl sm:text-3xl mt-1">{formatBaht(order.total)}</h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0 pb-1">
                        <Badge tone={status.tone}>{status.label}</Badge>
                        <Badge tone={PRODUCT_TYPE_TONE[order.type]}>{PRODUCT_TYPE_LABEL[order.type]}</Badge>
                        <OrderStatusEditor
                            orderId={order.id}
                            orderNo={order.orderNo}
                            currentStatus={order.status}
                            currentTrackingNo={order.trackingNo}
                            currentNote={order.adminNote}
                        />
                    </div>
                </div>
            </div>

            {order.paymentIssueAt && (
                <Notice tone="danger" title="⚠ เงินเข้าแล้วแต่ระบบรับออเดอร์ไม่ได้">
                    <p>
                        ลูกค้าชำระเงินสำเร็จ แต่ตอนเงินเข้าออเดอร์อยู่ในสถานะ <strong>{ORDER_STATUS[order.status].label}</strong> แล้ว
                        สินค้าจึงถูกคืนเข้าสต็อกไปให้ผู้ซื้อคนอื่น
                    </p>
                    <p className="mt-2">
                        ต้องเลือกอย่างใดอย่างหนึ่ง: <strong>คืนเงินให้ลูกค้าผ่าน Stripe Dashboard</strong> (ระบบนี้ยังไม่ได้ต่อ API คืนเงิน)
                        หรือจัดส่งสินค้าให้ถ้ายังมีของ แล้วค่อยเปลี่ยนสถานะกลับเป็นชำระแล้ว
                    </p>
                    {order.stripePaymentIntentId && (
                        <p className="mt-2 tnum text-[13px]">Payment Intent: {order.stripePaymentIntentId}</p>
                    )}
                </Notice>
            )}

            <Card className="p-6 space-y-4">
                <p className="eyebrow">รายการสินค้า · {itemCount} ชิ้น</p>
                <ul className="divide-y divide-line border-y border-line">
                    {order.items.map((i) => (
                        <li key={i.id} className="flex items-center gap-4 py-3">
                            <div className="min-w-0 flex-1">
                                {i.product ? (
                                    <Link
                                        href={`/shop/${i.product.slug}`}
                                        target="_blank"
                                        className="text-sm font-semibold tracking-tight hover:text-ink-soft transition-colors line-clamp-1"
                                    >
                                        {i.productName}
                                    </Link>
                                ) : (
                                    <p className="text-sm font-semibold tracking-tight line-clamp-1">
                                        {i.productName}
                                        <span className="text-ink-mute font-normal"> · สินค้าถูกลบแล้ว</span>
                                    </p>
                                )}
                                <p className="text-[11px] text-ink-mute tnum mt-0.5">
                                    {i.variantName} · {formatBaht(i.unitPrice)} × {i.quantity}
                                </p>
                            </div>
                            <span className="numeral text-base shrink-0">{formatBaht(i.lineTotal)}</span>
                        </li>
                    ))}
                </ul>

                <dl className="space-y-1.5 text-sm tnum">
                    <Row label="ยอดสินค้า" value={formatBaht(order.subtotal)} />
                    <Row label={`ค่าจัดส่ง (${DELIVERY_LABEL[order.deliveryMethod]})`} value={formatBaht(order.shippingFee)} />
                    <div className="flex justify-between pt-2 border-t border-line font-semibold text-base">
                        <dt>ยอดรวม</dt>
                        <dd className="numeral">{formatBaht(order.total)}</dd>
                    </div>
                </dl>
            </Card>

            <Card className="p-6 space-y-3">
                <p className="eyebrow">ผู้สั่งซื้อ</p>
                <dl className="space-y-1.5 text-sm">
                    <Row label="บัญชี" value={order.user.name || "—"} />
                    <Row label="อีเมล" value={order.user.email} />
                    <Row label="วิธีรับของ" value={DELIVERY_LABEL[order.deliveryMethod]} />
                    {order.recipientName && <Row label="ชื่อผู้รับ" value={order.recipientName} />}
                    {order.recipientPhone && <Row label="เบอร์ผู้รับ" value={order.recipientPhone} />}
                    {order.address && (
                        <Row
                            label="ที่อยู่"
                            value={`${order.address} ${order.province ?? ""} ${order.postalCode ?? ""}`.trim()}
                        />
                    )}
                    {order.trackingNo && <Row label="เลขพัสดุ" value={order.trackingNo} />}
                    {order.customerNote && <Row label="หมายเหตุจากผู้ซื้อ" value={order.customerNote} />}
                </dl>
            </Card>

            <Card className="p-6 space-y-3">
                <p className="eyebrow">การชำระเงินและเวลา</p>
                <dl className="space-y-1.5 text-sm tnum">
                    <Row label="สั่งเมื่อ" value={`${formatDate(order.createdAt)} ${formatTime(order.createdAt)}`} />
                    {order.expiresAt && (
                        <Row label="ต้องชำระภายใน" value={`${formatDate(order.expiresAt)} ${formatTime(order.expiresAt)}`} />
                    )}
                    {order.paidAt && <Row label="ชำระเมื่อ" value={`${formatDate(order.paidAt)} ${formatTime(order.paidAt)}`} />}
                    {order.paymentMethod && <Row label="วิธีชำระ" value={order.paymentMethod} />}
                    {order.shippedAt && <Row label="ส่งเมื่อ" value={formatDate(order.shippedAt)} />}
                    {order.pickedUpAt && <Row label="รับของเมื่อ" value={formatDate(order.pickedUpAt)} />}
                    {order.stripePaymentIntentId && (
                        <Row label="Stripe PI" value={order.stripePaymentIntentId} />
                    )}
                </dl>

                {order.receiptUrl && (
                    <a
                        href={order.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="eyebrow text-ink-soft hover:text-ink transition-colors inline-block"
                    >
                        เปิดใบเสร็จของ Stripe
                    </a>
                )}
            </Card>

            {order.adminNote && (
                <Card className="p-6">
                    <p className="eyebrow mb-2">บันทึกภายใน</p>
                    <p className="text-sm text-ink-soft">{order.adminNote}</p>
                </Card>
            )}
        </div>
    )
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-6">
            <dt className="text-ink-mute shrink-0">{label}</dt>
            <dd className="text-right break-words min-w-0">{value}</dd>
        </div>
    )
}

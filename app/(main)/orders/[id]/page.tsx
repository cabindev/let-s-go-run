import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth-helpers"
import { Card } from "@/components/ui/Card"
import { Badge, Notice } from "@/components/ui/Badge"
import { ButtonLink } from "@/components/ui/Button"
import { ConfirmAction } from "@/components/ui/ConfirmAction"
import { Countdown } from "@/components/payment/Countdown"
import { PaymentStatusPoller } from "@/components/payment/PaymentStatusPoller"
import { OrderCheckoutButton } from "@/components/shop/OrderCheckoutButton"
import { cancelOrder } from "@/app/actions/order"
import { expireStaleOrders, isOrderExpired } from "@/lib/order-stock"
import {
    DELIVERY_LABEL,
    getShopSetting,
    ORDER_PAYMENT_WINDOW_HOURS,
    ORDER_STATUS,
    PRODUCT_TYPE_LABEL,
    PRODUCT_TYPE_TONE,
    SHOP_NAME,
} from "@/lib/shop"
import { formatBaht, formatDate, formatTime } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: `คำสั่งซื้อ · ${SHOP_NAME}` }

export default async function OrderDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ checkout?: string }>
}) {
    const { id } = await params
    const { checkout } = await searchParams
    const user = await requireUser()

    await expireStaleOrders()

    const order = await prisma.order.findUnique({
        where: { id },
        include: { items: { include: { product: { select: { slug: true } } } } },
    })

    if (!order) notFound()
    // ออเดอร์ของคนอื่นต้องเปิดไม่ได้ แม้จะรู้ id
    if (order.userId !== user.id) redirect("/orders")

    const setting = await getShopSetting()
    const status = ORDER_STATUS[order.status]
    const expired = isOrderExpired(order)
    const canPay = !expired && order.status === "PENDING" && order.total > 0
    const itemCount = order.items.reduce((s, i) => s + i.quantity, 0)

    return (
        <div className="pt-4 max-w-xl mx-auto space-y-10">
            <Link
                href="/orders"
                className="inline-flex items-center gap-2 text-[15px] font-semibold text-ink-mute hover:text-ink transition-colors"
            >
                <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                คำสั่งซื้อของฉัน
            </Link>

            <div>
                <div className="flex items-start justify-between gap-3">
                    <p className="eyebrow tnum">{order.orderNo}</p>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Badge tone={PRODUCT_TYPE_TONE[order.type]}>{PRODUCT_TYPE_LABEL[order.type]}</Badge>
                        <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                </div>
                <h1 className="display text-2xl sm:text-3xl mt-2">
                    {itemCount} ชิ้น · {formatBaht(order.total)}
                </h1>
                <p className="text-[15px] text-ink-mute mt-2 tnum">
                    สั่งเมื่อ {formatDate(order.createdAt)} {formatTime(order.createdAt)} · {DELIVERY_LABEL[order.deliveryMethod]}
                </p>
            </div>

            {order.status === "PENDING" && order.expiresAt && !expired && (
                <Notice tone="sky" title="เหลือเวลาชำระเงิน">
                    <p className="numeral text-2xl mt-1">
                        <Countdown deadline={order.expiresAt.getTime()} />
                    </p>
                    <p className="mt-1">
                        ต้องชำระเงินภายใน {ORDER_PAYMENT_WINDOW_HOURS} ชั่วโมงหลังสั่งซื้อ
                        มิฉะนั้นระบบจะคืนสินค้าเข้าสต็อกให้คนอื่นซื้อต่อโดยอัตโนมัติ
                    </p>
                </Notice>
            )}

            {checkout === "success" && <PaymentStatusPoller status={order.status} />}

            {checkout === "cancel" && order.status === "PENDING" && (
                <Notice tone="neutral" title="ยกเลิกการชำระเงิน">
                    <p>ยังไม่ได้ตัดเงิน คุณสามารถลองชำระใหม่ได้อีกครั้ง</p>
                </Notice>
            )}

            {expired && (
                <Notice tone="danger" title="หมดเวลาชำระเงินแล้ว">
                    <p>สินค้าถูกคืนเข้าสต็อกให้ผู้ซื้อคนอื่นแล้ว หากยังต้องการสั่งซื้อกรุณาสั่งใหม่อีกครั้ง</p>
                    <ButtonLink href="/shop" variant="outline" size="sm" className="mt-3">
                        กลับไปที่ร้านค้า
                    </ButtonLink>
                </Notice>
            )}

            {order.status === "PAID" && (
                <Notice tone="lime" title="ชำระเงินเรียบร้อยแล้ว">
                    <p>
                        {order.type === "PREORDER"
                            ? "ทางร้านจะผลิตและจัดส่งตามรอบที่แจ้งไว้ในหน้าสินค้า"
                            : order.deliveryMethod === "SHIPPING"
                                ? "ทางร้านจะจัดส่งตามที่อยู่ที่แจ้งไว้ และแจ้งเลขพัสดุให้ทราบ"
                                : "ติดต่อรับของได้ตามจุดนัดหมายของผู้จัด"}
                    </p>
                    {order.deliveryMethod === "PICKUP" && setting.pickupLocation && (
                        <p className="mt-2">จุดรับของ: {setting.pickupLocation}</p>
                    )}
                    {order.receiptUrl && (
                        <ButtonLink href={order.receiptUrl} target="_blank" size="sm" variant="outline" className="mt-3">
                            ดาวน์โหลดใบเสร็จ
                        </ButtonLink>
                    )}
                </Notice>
            )}

            {order.status === "SHIPPED" && (
                <Notice tone="sky" title="จัดส่งแล้ว">
                    <p>{order.trackingNo ? `เลขพัสดุ ${order.trackingNo}` : "ทางร้านจะแจ้งเลขพัสดุให้ทราบเร็ว ๆ นี้"}</p>
                </Notice>
            )}

            {(order.status === "CANCELLED" || order.status === "REFUNDED") && (
                <Card className="p-6 text-center">
                    <p className="text-sm text-ink-soft">
                        {order.status === "CANCELLED" ? "ออเดอร์นี้ถูกยกเลิกแล้ว" : "ออเดอร์นี้คืนเงินแล้ว"}
                    </p>
                    <ButtonLink href="/shop" variant="outline" size="sm" className="mt-4">
                        กลับไปที่ร้านค้า
                    </ButtonLink>
                </Card>
            )}

            <Card className="p-6 space-y-4">
                <p className="eyebrow">รายการสินค้า</p>
                <ul className="divide-y divide-line border-y border-line">
                    {order.items.map((i) => (
                        <li key={i.id} className="flex items-center gap-4 py-3">
                            <div className="min-w-0 flex-1">
                                {i.product ? (
                                    <Link
                                        href={`/shop/${i.product.slug}`}
                                        className="text-sm font-semibold tracking-tight hover:text-ink-soft transition-colors line-clamp-1"
                                    >
                                        {i.productName}
                                    </Link>
                                ) : (
                                    <p className="text-sm font-semibold tracking-tight line-clamp-1">{i.productName}</p>
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
                    <div className="flex justify-between">
                        <dt className="text-ink-mute">ยอดสินค้า</dt>
                        <dd>{formatBaht(order.subtotal)}</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="text-ink-mute">ค่าจัดส่ง</dt>
                        <dd>{formatBaht(order.shippingFee)}</dd>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-line font-semibold text-base">
                        <dt>ยอดรวม</dt>
                        <dd className="numeral">{formatBaht(order.total)}</dd>
                    </div>
                </dl>
            </Card>

            {order.deliveryMethod === "SHIPPING" && order.address && (
                <Card className="p-6 space-y-2">
                    <p className="eyebrow">ที่อยู่จัดส่ง</p>
                    <p className="text-sm text-ink-soft leading-relaxed">
                        {order.recipientName}
                        {order.recipientPhone && ` · ${order.recipientPhone}`}
                        <br />
                        {order.address} {order.province} {order.postalCode}
                    </p>
                    {order.trackingNo && (
                        <p className="text-[13px] text-ink-mute tnum">เลขพัสดุ {order.trackingNo}</p>
                    )}
                </Card>
            )}

            {canPay && (
                <div className="space-y-4">
                    <OrderCheckoutButton orderId={order.id} amount={order.total} />
                    <ConfirmAction
                        action={cancelOrder.bind(null, order.id)}
                        title="ยกเลิกคำสั่งซื้อ?"
                        message="สินค้าจะถูกคืนเข้าสต็อกให้ผู้ซื้อคนอื่นทันที และต้องสั่งใหม่หากเปลี่ยนใจภายหลัง"
                        confirmLabel="ยกเลิกคำสั่งซื้อ"
                        className="w-full text-center text-[13px] text-ink-mute hover:text-danger transition-colors"
                    >
                        ยกเลิกคำสั่งซื้อ
                    </ConfirmAction>
                </div>
            )}
        </div>
    )
}

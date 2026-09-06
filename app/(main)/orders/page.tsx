import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth-helpers"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { ButtonLink } from "@/components/ui/Button"
import { EmptyState } from "@/components/ui/EmptyState"
import { expireStaleOrders, orderTimeLeft } from "@/lib/order-stock"
import { DELIVERY_LABEL, ORDER_STATUS, PRODUCT_TYPE_LABEL, PRODUCT_TYPE_TONE, SHOP_NAME } from "@/lib/shop"
import { formatTimeLeft } from "@/lib/expiry"
import { formatBaht, formatDate } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: `คำสั่งซื้อของฉัน · ${SHOP_NAME}` }

export default async function OrdersPage() {
    const user = await requireUser()

    // ให้สถานะที่เห็นตรงกับความจริงก่อนดึงรายการ
    await expireStaleOrders()

    const orders = await prisma.order.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: { items: true },
    })

    const now = new Date()
    const active = orders.filter((o) => !["COMPLETED", "CANCELLED", "EXPIRED", "REFUNDED"].includes(o.status))
    const past = orders.filter((o) => ["COMPLETED", "CANCELLED", "EXPIRED", "REFUNDED"].includes(o.status))

    return (
        <div className="pt-4 max-w-2xl mx-auto space-y-10">
            <div className="flex items-end justify-between gap-4">
                <div>
                    <p className="eyebrow">{SHOP_NAME}</p>
                    <h1 className="display text-2xl sm:text-3xl mt-1.5">คำสั่งซื้อของฉัน</h1>
                </div>
                <ButtonLink href="/shop" variant="outline" size="sm" className="shrink-0">
                    ไปที่ร้านค้า
                </ButtonLink>
            </div>

            {orders.length === 0 ? (
                <Card>
                    <EmptyState
                        title="ยังไม่มีคำสั่งซื้อ"
                        description="เมื่อคุณสั่งซื้อสินค้า รายการจะแสดงที่นี่"
                        actionLabel="ไปเลือกสินค้า"
                        actionHref="/shop"
                    />
                </Card>
            ) : (
                <>
                    {active.length > 0 && (
                        <section>
                            <p className="eyebrow mb-3">กำลังดำเนินการ · {active.length}</p>
                            <ul className="divide-y divide-line">
                                {active.map((o) => (
                                    <OrderRow key={o.id} order={o} now={now} />
                                ))}
                            </ul>
                        </section>
                    )}

                    {past.length > 0 && (
                        <section>
                            <p className="eyebrow mb-3">ประวัติ · {past.length}</p>
                            <ul className="divide-y divide-line">
                                {past.map((o) => (
                                    <OrderRow key={o.id} order={o} now={now} past />
                                ))}
                            </ul>
                        </section>
                    )}
                </>
            )}
        </div>
    )
}

type OrderRowData = Awaited<ReturnType<typeof prisma.order.findMany<{ include: { items: true } }>>>[number]

function OrderRow({ order, now, past }: { order: OrderRowData; now: Date; past?: boolean }) {
    const status = ORDER_STATUS[order.status]
    const left = orderTimeLeft(order, now)
    const itemCount = order.items.reduce((s, i) => s + i.quantity, 0)

    return (
        <li className={`flex items-start gap-4 py-4 ${past ? "opacity-60" : ""}`}>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        href={`/orders/${order.id}`}
                        className="text-sm font-semibold tracking-tight tnum hover:text-ink-soft transition-colors"
                    >
                        {order.orderNo}
                    </Link>
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <Badge tone={PRODUCT_TYPE_TONE[order.type]}>{PRODUCT_TYPE_LABEL[order.type]}</Badge>
                </div>

                <p className="text-[13px] text-ink-soft truncate mt-1">
                    {order.items.map((i) => `${i.productName} · ${i.variantName} ×${i.quantity}`).join(" / ")}
                </p>

                <p className="text-[11px] text-ink-mute tnum mt-0.5">
                    {itemCount} ชิ้น · {DELIVERY_LABEL[order.deliveryMethod]} · สั่ง {formatDate(order.createdAt)}
                    {order.trackingNo && ` · พัสดุ ${order.trackingNo}`}
                </p>

                {left !== null && (
                    <p className="text-[12px] text-danger tnum mt-1">
                        เหลือเวลาชำระเงิน {formatTimeLeft(left)}
                    </p>
                )}
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
                <p className="numeral text-base">{formatBaht(order.total)}</p>
                {order.status === "PENDING" && (
                    <ButtonLink href={`/orders/${order.id}`} size="sm">
                        ชำระเงิน
                    </ButtonLink>
                )}
                {order.receiptUrl && (
                    <ButtonLink href={order.receiptUrl} target="_blank" size="sm" variant="ghost">
                        ใบเสร็จ
                    </ButtonLink>
                )}
            </div>
        </li>
    )
}

import Link from "next/link"
import type { OrderStatus } from "@prisma/client"
import { Download } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Card } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { Badge, Notice } from "@/components/ui/Badge"
import { ButtonLink } from "@/components/ui/Button"
import { EmptyState } from "@/components/ui/EmptyState"
import { OrderStatusEditor } from "@/components/admin/OrderStatusEditor"
import { OrderFilters } from "@/components/admin/OrderFilters"
import { Pagination } from "@/components/admin/Pagination"
import { buildOrderWhere } from "@/lib/shop-order-query"
import { expireStaleOrders, orderTimeLeft } from "@/lib/order-stock"
import { DELIVERY_LABEL, ORDER_STATUS, PRODUCT_TYPE_LABEL, PRODUCT_TYPE_TONE } from "@/lib/shop"
import { formatTimeLeft } from "@/lib/expiry"
import { cn, formatBaht, formatDate } from "@/lib/utils"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 100

/** สถานะที่ยกขึ้นมาเป็นการ์ดสรุปด้านบน — ที่เหลือกรองผ่านช่องค้นหา */
const HIGHLIGHT: OrderStatus[] = ["PENDING", "PAID", "PREPARING", "SHIPPED"]

export default async function AdminOrdersPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string; type?: string; q?: string; page?: string }>
}) {
    const { status, type, q, page: pageParam } = await searchParams
    const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1)

    // ให้สถานะและสต็อกที่เห็นตรงกับความจริงก่อนดึงรายการ
    await expireStaleOrders()

    const where = buildOrderWhere({ status, type, q })

    const exportParams = new URLSearchParams()
    if (status) exportParams.set("status", status)
    if (type) exportParams.set("type", type)
    if (q) exportParams.set("q", q)
    const exportHref = `/api/admin/orders/export${exportParams.size ? `?${exportParams}` : ""}`

    const [orders, filteredTotal, counts, revenue, paymentIssues] = await Promise.all([
        prisma.order.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
            include: {
                user: { select: { name: true, email: true, image: true } },
                items: true,
            },
        }),
        prisma.order.count({ where }),
        prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.order.aggregate({
            where: { status: { in: ["PAID", "PREPARING", "SHIPPED", "COMPLETED"] } },
            _sum: { total: true },
        }),
        // เงินเข้าแล้วแต่ระบบรับออเดอร์ไม่ได้ — ต้องเด้งเตือนตลอดจนกว่าจะมีคนจัดการ
        prisma.order.findMany({
            where: { paymentIssueAt: { not: null } },
            orderBy: { paymentIssueAt: "desc" },
            select: { id: true, orderNo: true, status: true, total: true, user: { select: { email: true } } },
        }),
    ])

    const countOf = (s: OrderStatus) => counts.find((c) => c.status === s)?._count._all ?? 0
    const total = counts.reduce((sum, c) => sum + c._count._all, 0)
    const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE))
    const rangeStart = filteredTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
    const rangeEnd = rangeStart + orders.length - 1
    const now = new Date()

    return (
        <div className="space-y-8">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="eyebrow tnum">
                        ทั้งหมด {total} ออเดอร์ · ยอดขาย {formatBaht(revenue._sum.total ?? 0)}
                    </p>
                    <h1 className="display text-3xl sm:text-4xl mt-2">ออเดอร์ร้านค้า</h1>
                </div>
                <ButtonLink href={exportHref} variant="outline" size="sm" className="shrink-0">
                    <Download className="w-4 h-4" strokeWidth={2.2} />
                    Excel
                </ButtonLink>
            </div>

            {paymentIssues.length > 0 && (
                <Notice
                    tone="danger"
                    title={`⚠ มี ${paymentIssues.length} ออเดอร์ที่เงินเข้าแล้วแต่ระบบรับไม่ได้`}
                >
                    <p className="mb-2">
                        ลูกค้าชำระเงินสำเร็จ แต่ตอนเงินเข้าออเดอร์หมดเวลาหรือถูกยกเลิกไปแล้ว
                        สินค้าถูกคืนเข้าสต็อกไปแล้ว — <strong>ต้องคืนเงินหรือจัดส่งให้ลูกค้า</strong>
                    </p>
                    <ul className="space-y-1">
                        {paymentIssues.map((o) => (
                            <li key={o.id}>
                                <Link
                                    href={`/admin/orders/${o.id}`}
                                    className="text-[13px] font-semibold tnum underline hover:no-underline"
                                >
                                    {o.orderNo}
                                </Link>
                                <span className="text-[13px] tnum"> · {formatBaht(o.total)} · {o.user.email} · สถานะ {o.status}</span>
                            </li>
                        ))}
                    </ul>
                </Notice>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {HIGHLIGHT.map((s) => {
                    const active = status === s
                    const n = countOf(s)
                    return (
                        <Link
                            key={s}
                            href={active ? "/admin/orders" : `/admin/orders?status=${s}`}
                            className={cn(
                                "rounded-2xl border p-4 transition-colors",
                                active ? "border-ink bg-paper ring-1 ring-ink" : "border-line bg-paper hover:border-ink-mute"
                            )}
                        >
                            <p className="eyebrow truncate">{ORDER_STATUS[s].label}</p>
                            <p className={cn("numeral text-2xl mt-1", s === "PAID" && n > 0 && "text-danger")}>{n}</p>
                        </Link>
                    )
                })}
            </div>

            <OrderFilters />

            {orders.length === 0 ? (
                <Card>
                    <EmptyState
                        title="ไม่พบออเดอร์"
                        description={q || status || type ? "ลองเปลี่ยนตัวกรองหรือคำค้นหา" : "เมื่อมีคนสั่งซื้อ ออเดอร์จะแสดงที่นี่"}
                    />
                </Card>
            ) : (
                <>
                    <p className="eyebrow tnum">
                        แสดง {rangeStart}-{rangeEnd} จาก {filteredTotal} ออเดอร์
                    </p>

                    <ul className="divide-y divide-line">
                        {orders.map((o) => {
                            const st = ORDER_STATUS[o.status]
                            const left = orderTimeLeft(o, now)
                            const itemCount = o.items.reduce((s, i) => s + i.quantity, 0)
                            const needsShipping =
                                o.deliveryMethod === "SHIPPING" && (o.status === "PAID" || o.status === "PREPARING")

                            return (
                                <li key={o.id} className="flex items-start gap-3 py-4">
                                    <Avatar src={o.user.image} name={o.user.name} email={o.user.email} size={40} />

                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Link
                                                href={`/admin/orders/${o.id}`}
                                                className="text-sm font-semibold tracking-tight tnum hover:text-ink-soft transition-colors"
                                            >
                                                {o.orderNo}
                                            </Link>
                                            <Badge tone={st.tone}>{st.label}</Badge>
                                            <Badge tone={PRODUCT_TYPE_TONE[o.type]}>{PRODUCT_TYPE_LABEL[o.type]}</Badge>
                                            {left !== null && (
                                                <Badge tone={left < 3600_000 ? "danger" : "outline"}>
                                                    เหลือ {formatTimeLeft(left)}
                                                </Badge>
                                            )}
                                            {needsShipping && !o.trackingNo && <Badge tone="danger">รอส่ง</Badge>}
                                            {o.paymentIssueAt && <Badge tone="danger">เงินเข้าแต่ออเดอร์ไม่สมบูรณ์</Badge>}
                                        </div>

                                        <p className="text-[11px] text-ink-mute truncate mt-0.5">
                                            {o.recipientName || o.user.name || o.user.email}
                                            {o.recipientPhone && ` · ${o.recipientPhone}`}
                                            {` · ${DELIVERY_LABEL[o.deliveryMethod]}`}
                                        </p>

                                        <p className="text-[12px] text-ink-soft truncate mt-1">
                                            {o.items.map((i) => `${i.productName} · ${i.variantName} ×${i.quantity}`).join(" / ")}
                                        </p>

                                        <p className="text-[11px] text-ink-mute tnum mt-0.5">
                                            {itemCount} ชิ้น · สั่ง {formatDate(o.createdAt)}
                                            {o.paidAt && ` · จ่าย ${formatDate(o.paidAt)}`}
                                            {o.trackingNo && ` · พัสดุ ${o.trackingNo}`}
                                        </p>

                                        {o.address && (
                                            <p className="text-[11px] text-ink-mute mt-0.5 line-clamp-2">
                                                {o.address} {o.province} {o.postalCode}
                                            </p>
                                        )}

                                        {o.adminNote && <p className="text-[11px] text-danger mt-1">{o.adminNote}</p>}
                                    </div>

                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                        <p className="numeral text-base">{formatBaht(o.total)}</p>
                                        <OrderStatusEditor
                                            orderId={o.id}
                                            orderNo={o.orderNo}
                                            currentStatus={o.status}
                                            currentTrackingNo={o.trackingNo}
                                            currentNote={o.adminNote}
                                        />
                                    </div>
                                </li>
                            )
                        })}
                    </ul>

                    <Pagination page={page} totalPages={totalPages} basePath="/admin/orders" params={{ status, type, q }} />
                </>
            )}
        </div>
    )
}

import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { deleteProduct } from "@/app/actions/shop-admin"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { ButtonLink } from "@/components/ui/Button"
import { ConfirmAction } from "@/components/ui/ConfirmAction"
import { PRODUCT_TYPE_LABEL, PRODUCT_TYPE_TONE, stockLabel } from "@/lib/shop"
import { coverImage } from "@/lib/product-image-groups"
import { formatPrice } from "@/lib/utils"

export const dynamic = "force-dynamic"

const STATUS_LABEL = {
    DRAFT: { label: "ร่าง", tone: "outline" },
    ACTIVE: { label: "เปิดขาย", tone: "lime" },
    HIDDEN: { label: "ซ่อน", tone: "neutral" },
} as const

export default async function AdminProductsPage() {
    const products = await prisma.product.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        include: {
            variants: { orderBy: { sortOrder: "asc" } },
            images: { orderBy: [{ category: "asc" }, { sortOrder: "asc" }], take: 4 },
            event: { select: { title: true } },
            _count: { select: { orderItems: true } },
        },
    })

    return (
        <div className="space-y-10">
            <div className="flex items-end justify-between gap-4">
                <div>
                    <p className="eyebrow tnum">{products.length} สินค้า</p>
                    <h1 className="display text-3xl sm:text-4xl mt-2">สินค้า</h1>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                    <ButtonLink href="/admin/products/new">+ เพิ่มสินค้า</ButtonLink>
                    <ButtonLink href="/admin/shop" variant="outline">ตั้งค่าร้าน</ButtonLink>
                </div>
            </div>

            {products.length === 0 ? (
                <Card>
                    <EmptyState
                        title="ยังไม่มีสินค้า"
                        description="เพิ่มสินค้าชิ้นแรกเพื่อเปิดร้าน"
                        actionLabel="เพิ่มสินค้า"
                        actionHref="/admin/products/new"
                    />
                </Card>
            ) : (
                <ul className="divide-y divide-line">
                    {products.map((p) => {
                        const status = STATUS_LABEL[p.status]
                        const unlimited = p.variants.some((v) => v.stock === null)
                        const totalStock = p.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0)
                        const stock = unlimited ? null : stockLabel(totalStock)

                        return (
                            <li key={p.id} className="flex items-center gap-4 py-4">
                                {coverImage(p.images) ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={coverImage(p.images)!.url}
                                        alt=""
                                        className="w-14 h-14 rounded-xl object-cover border border-line shrink-0"
                                    />
                                ) : (
                                    <div className="w-14 h-14 rounded-xl bg-paper-2 border border-line shrink-0" />
                                )}

                                <div className="min-w-0 flex-1">
                                    <Link
                                        href={`/admin/products/${p.id}/edit`}
                                        className="font-semibold tracking-tight hover:text-ink-soft transition-colors line-clamp-1"
                                    >
                                        {p.name}
                                    </Link>
                                    <p className="text-[11px] text-ink-mute mt-1 tnum">
                                        {formatPrice(p.price)} · {p.variants.length} ตัวเลือก
                                        {p.event && ` · ${p.event.title}`}
                                        {p._count.orderItems > 0 && ` · ขายไปแล้ว ${p._count.orderItems} รายการ`}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                        <Badge tone={status.tone}>{status.label}</Badge>
                                        <Badge tone={PRODUCT_TYPE_TONE[p.type]}>{PRODUCT_TYPE_LABEL[p.type]}</Badge>
                                        {stock ? (
                                            <Badge tone={stock.tone}>{stock.label}</Badge>
                                        ) : (
                                            <Badge tone="outline">ไม่จำกัดจำนวน</Badge>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                                    <Link
                                        href={`/shop/${p.slug}`}
                                        target="_blank"
                                        className="eyebrow text-ink-mute hover:text-ink transition-colors"
                                    >
                                        ดูหน้าจริง
                                    </Link>
                                    <Link
                                        href={`/admin/products/${p.id}/edit`}
                                        className="eyebrow text-ink-soft hover:text-ink transition-colors"
                                    >
                                        แก้ไข
                                    </Link>
                                    <ConfirmAction
                                        action={deleteProduct.bind(null, p.id)}
                                        title="ลบสินค้านี้?"
                                        message={`"${p.name}" จะถูกลบถาวรพร้อมตัวเลือกและรูปทั้งหมด ย้อนกลับไม่ได้`}
                                        confirmLabel="ลบสินค้า"
                                        className="eyebrow text-ink-mute hover:text-danger transition-colors"
                                    >
                                        ลบ
                                    </ConfirmAction>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}

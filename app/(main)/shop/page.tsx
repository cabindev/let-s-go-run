import Link from "next/link"
import type { Prisma, ProductType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { Card } from "@/components/ui/Card"
import { Notice } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { ProductCard } from "@/components/shop/ProductCard"
import { getShopSetting, PRODUCT_TYPE_LABEL, SHOP_NAME } from "@/lib/shop"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: `${SHOP_NAME} · RunLudtong` }

const TABS = [
    { key: "", label: "ทั้งหมด" },
    { key: "STOCK", label: PRODUCT_TYPE_LABEL.STOCK },
    { key: "PREORDER", label: PRODUCT_TYPE_LABEL.PREORDER },
] as const

export default async function ShopPage({
    searchParams,
}: {
    searchParams: Promise<{ type?: string }>
}) {
    const { type } = await searchParams
    const activeType = type === "STOCK" || type === "PREORDER" ? (type as ProductType) : null

    // เห็นเฉพาะสินค้าที่เปิดขายเท่านั้น — DRAFT/HIDDEN ถูกกรองที่นี่และตรวจซ้ำตอนใส่ตะกร้า
    const where: Prisma.ProductWhereInput = {
        status: "ACTIVE",
        ...(activeType ? { type: activeType } : {}),
    }

    const [products, setting] = await Promise.all([
        prisma.product.findMany({
            where,
            orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
            include: {
                variants: { where: { active: true }, orderBy: { sortOrder: "asc" } },
                // ดึงมาไม่กี่รูปแล้วให้ coverImage() เลือก "ด้านหน้า" เป็นปก
                images: { orderBy: [{ category: "asc" }, { sortOrder: "asc" }], take: 4 },
                event: { select: { title: true } },
            },
        }),
        getShopSetting(),
    ])

    /*
     * ไม่กรองสินค้าที่ "ซื้อไม่ได้" ออกจากรายการ
     *
     * พรีออเดอร์ที่เลยกำหนดยังต้องให้คนเห็นว่ามีของชิ้นนี้อยู่ พร้อมป้ายบอกว่าปิดรับแล้ว
     * ไม่ใช่หายไปเงียบ ๆ — การกันไม่ให้สั่งจริงทำที่ตอนใส่ตะกร้าและตอนสร้างออเดอร์อยู่แล้ว
     * (app/actions/cart.ts, app/actions/order.ts, lib/cart.ts) ตรงนี้เป็นแค่การแสดงผล
     */

    return (
        <div className="pt-4 space-y-8">
            <div>
                <p className="eyebrow">{SHOP_NAME}</p>
                <h1 className="display text-[clamp(1.4rem,3vw,1.875rem)] mt-1.5">สินค้าและของที่ระลึก</h1>
                <p className="text-ink-soft text-[15px] mt-2">
                    เลือกสินค้า ใส่ตะกร้า แล้วชำระเงินผ่านระบบได้ทันที · รับเองที่จุดนัดหมายหรือส่งไปรษณีย์ก็ได้
                </p>
            </div>

            {setting.announcement && <Notice tone="move">{setting.announcement}</Notice>}

            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0">
                {TABS.map((t) => {
                    const active = (activeType ?? "") === t.key
                    return (
                        <Link
                            key={t.key}
                            href={t.key ? `/shop?type=${t.key}` : "/shop"}
                            className={cn(
                                "shrink-0 px-4 h-9 inline-flex items-center rounded-full text-[13px] font-medium tracking-tight transition-colors",
                                active ? "bg-ink text-white" : "bg-paper border border-line text-ink-soft hover:text-ink"
                            )}
                        >
                            {t.label}
                        </Link>
                    )
                })}
            </div>

            {products.length === 0 ? (
                <Card>
                    <EmptyState
                        title="ยังไม่มีสินค้าในหมวดนี้"
                        description="กลับมาดูใหม่อีกครั้งเร็ว ๆ นี้"
                    />
                </Card>
            ) : (
                <>
                    <p className="eyebrow tnum">{products.length} รายการ</p>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {products.map((p) => <ProductCard key={p.id} product={p} />)}
                    </div>
                </>
            )}
        </div>
    )
}

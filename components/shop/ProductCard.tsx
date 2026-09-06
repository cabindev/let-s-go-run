import Link from "next/link"
import type { ProductImageCategory, ProductType } from "@prisma/client"
import { Badge } from "@/components/ui/Badge"
import { hasStock, PRODUCT_TYPE_LABEL, PRODUCT_TYPE_TONE, variantPrice } from "@/lib/shop"
import { coverImage } from "@/lib/product-image-groups"
import { cn, formatDate, formatPrice } from "@/lib/utils"

/** ข้อมูลขั้นต่ำที่การ์ดต้องใช้ — ใช้ร่วมกันทั้งหน้าร้านและหน้าแรก */
export interface ProductCardData {
    id: string
    slug: string
    name: string
    price: number
    type: ProductType
    estimatedShipAt: Date | null
    images: { url: string; category: ProductImageCategory; sortOrder: number }[]
    variants: { stock: number | null; active: boolean; price: number | null }[]
    event: { title: string } | null
}

export function ProductCard({ product }: { product: ProductCardData }) {
    const inStock = hasStock(product.variants)
    const prices = product.variants.map((v) => variantPrice(product, v))
    const min = prices.length ? Math.min(...prices) : product.price
    const max = prices.length ? Math.max(...prices) : product.price
    const cover = coverImage(product.images)

    return (
        <Link
            href={`/shop/${product.slug}`}
            className="group bg-paper border border-line rounded-3xl overflow-hidden hover:border-ink-mute transition-colors flex flex-col"
        >
            <div className="aspect-[4/3] bg-paper-2 relative">
                {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={cover.url}
                        alt={product.name}
                        className={cn("w-full h-full object-cover transition-opacity", !inStock && "opacity-40")}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="eyebrow">ไม่มีรูป</span>
                    </div>
                )}
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    <Badge tone={PRODUCT_TYPE_TONE[product.type]}>{PRODUCT_TYPE_LABEL[product.type]}</Badge>
                    {!inStock && <Badge tone="neutral">สินค้าหมด</Badge>}
                </div>
            </div>

            <div className="p-5 flex-1 flex flex-col">
                <p className="font-semibold tracking-tight line-clamp-2 group-hover:text-ink-soft transition-colors">
                    {product.name}
                </p>
                {product.event && (
                    <p className="text-[11px] text-ink-mute mt-1 line-clamp-1">{product.event.title}</p>
                )}
                {product.type === "PREORDER" && product.estimatedShipAt && (
                    <p className="text-[11px] text-ink-mute tnum mt-1">
                        ส่งประมาณ {formatDate(product.estimatedShipAt)}
                    </p>
                )}
                <p className="numeral text-xl mt-auto pt-3">
                    {min === max ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`}
                </p>
            </div>
        </Link>
    )
}

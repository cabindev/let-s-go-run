import Link from "next/link"
import type { ProductImageCategory, ProductStatus, ProductType } from "@prisma/client"
import { Badge } from "@/components/ui/Badge"
import { hasStock, PRODUCT_TYPE_LABEL, PRODUCT_TYPE_TONE, purchasableState, variantPrice } from "@/lib/shop"
import { coverImage } from "@/lib/product-image-groups"
import { cn, formatDate, formatPrice } from "@/lib/utils"

/** ข้อมูลขั้นต่ำที่การ์ดต้องใช้ — ใช้ร่วมกันทั้งหน้าร้านและหน้าแรก */
export interface ProductCardData {
    id: string
    slug: string
    name: string
    price: number
    type: ProductType
    status: ProductStatus
    preorderCloseAt: Date | null
    estimatedShipAt: Date | null
    images: { url: string; category: ProductImageCategory; sortOrder: number }[]
    variants: { stock: number | null; active: boolean; price: number | null }[]
    event: { title: string } | null
}

/**
 * `compact` = การ์ดเวอร์ชันเล็กสำหรับแถบสินค้าบนหน้าแรก
 *
 * หน้าร้านมีสินค้าเป็นตัวเอกจึงใช้การ์ดใหญ่ได้เต็มที่ แต่บนหน้าแรกสินค้าอยู่ท้ายหน้า
 * ถัดจากรายการงานวิ่ง ถ้าใช้การ์ดขนาดเดียวกันจะเห็นได้แค่ 3 ชิ้นต่อหนึ่งจอ
 * ย่อลงแล้ววางสี่คอลัมน์ทำให้เห็นของได้มากกว่าโดยใช้ความสูงน้อยลง
 */
export function ProductCard({ product, compact }: { product: ProductCardData; compact?: boolean }) {
    /*
     * ปิดรับพรีออเดอร์แล้ว = ยังโชว์การ์ดอยู่ แค่บอกให้ชัดว่าสั่งไม่ได้
     *
     * ของเดิมกรองสินค้าพวกนี้ออกจากหน้ารายการไปเลย คนที่เคยเห็นของชิ้นนี้เมื่อวาน
     * กลับมาวันนี้แล้วของหายไปเฉย ๆ โดยไม่มีอะไรอธิบาย — หน้ารายละเอียดทำถูกอยู่แล้ว
     * (ยังเปิดดูได้ ขึ้นเหตุผล กดซื้อไม่ได้) การ์ดจึงควรพูดภาษาเดียวกัน
     */
    const state = purchasableState(product)
    const inStock = hasStock(product.variants)
    const dimmed = !state.ok || !inStock
    const prices = product.variants.map((v) => variantPrice(product, v))
    const min = prices.length ? Math.min(...prices) : product.price
    const max = prices.length ? Math.max(...prices) : product.price
    const cover = coverImage(product.images)

    return (
        <Link
            href={`/shop/${product.slug}`}
            className="group raise bg-paper border border-line rounded-3xl overflow-hidden hover:border-ink-mute transition-colors flex flex-col"
        >
            <div className="aspect-[4/3] bg-paper-2 relative">
                {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={cover.url}
                        alt={product.name}
                        className={cn("w-full h-full object-cover transition-opacity", dimmed && "opacity-40")}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="eyebrow">ไม่มีรูป</span>
                    </div>
                )}
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    <Badge tone={PRODUCT_TYPE_TONE[product.type]}>{PRODUCT_TYPE_LABEL[product.type]}</Badge>
                    {!state.ok && <Badge tone="neutral">{state.reason}</Badge>}
                    {state.ok && !inStock && <Badge tone="neutral">สินค้าหมด</Badge>}
                </div>
            </div>

            <div className={cn("flex-1 flex flex-col", compact ? "p-3.5 sm:p-4" : "p-5")}>
                <p className={cn(
                    "font-semibold tracking-tight line-clamp-2 group-hover:text-ink-soft transition-colors",
                    compact && "text-sm"
                )}>
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
                <p className={cn("numeral mt-auto", compact ? "text-base pt-2.5" : "text-xl pt-3")}>
                    {min === max ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`}
                </p>
            </div>
        </Link>
    )
}

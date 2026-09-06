import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth-helpers"
import { Badge, Notice } from "@/components/ui/Badge"
import { RichText } from "@/components/ui/RichText"
import { AddToCart, type VariantOption } from "@/components/shop/AddToCart"
import { ProductGalleryViewer } from "@/components/shop/ProductGalleryViewer"
import {
    DELIVERY_LABEL,
    getShopSetting,
    maxOrderable,
    PRODUCT_TYPE_LABEL,
    PRODUCT_TYPE_TONE,
    purchasableState,
    SHOP_NAME,
    variantPrice,
} from "@/lib/shop"
import { coverImage, PRODUCT_IMAGE_GROUPS } from "@/lib/product-image-groups"
import { eventHref } from "@/lib/events"
import { formatBaht, formatDate, formatPrice } from "@/lib/utils"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const product = await prisma.product.findUnique({
        where: { slug: decodeURIComponent(slug) },
        select: { name: true, status: true },
    })
    if (!product || product.status !== "ACTIVE") return { title: `${SHOP_NAME} · RunLudtong` }
    return { title: `${product.name} · ${SHOP_NAME}` }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const session = await getSession()

    const product = await prisma.product.findUnique({
        where: { slug: decodeURIComponent(slug) },
        include: {
            variants: { where: { active: true }, orderBy: { sortOrder: "asc" } },
            images: { orderBy: [{ category: "asc" }, { sortOrder: "asc" }] },
            event: { select: { id: true, title: true, type: true } },
        },
    })

    // สินค้าที่ยังไม่เผยแพร่/ถูกซ่อนต้องหาไม่เจอ แม้จะเดา slug ถูก
    if (!product || product.status !== "ACTIVE") notFound()

    const setting = await getShopSetting()
    const state = purchasableState(product)

    // เรียงรูปตามลำดับหมวด (ด้านหน้า → ด้านหลัง → ตัวอย่าง → ...) แล้วดันรูปปกขึ้นเป็นรูปแรก
    const cover = coverImage(product.images)
    const ordered = PRODUCT_IMAGE_GROUPS.flatMap((g) => product.images.filter((i) => i.category === g.key))
    const gallery = cover ? [cover, ...ordered.filter((i) => i.id !== cover.id)] : ordered

    const options: VariantOption[] = product.variants.map((v) => ({
        id: v.id,
        name: v.name,
        price: variantPrice(product, v),
        stock: v.stock,
        maxQty: state.ok ? maxOrderable(product, v) : 0,
    }))

    const prices = options.map((o) => o.price)
    const min = prices.length ? Math.min(...prices) : product.price
    const max = prices.length ? Math.max(...prices) : product.price

    return (
        <div className="pt-4 space-y-10">
            <Link
                href="/shop"
                className="inline-flex items-center gap-2 text-[15px] font-semibold text-ink-mute hover:text-ink transition-colors"
            >
                <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                กลับไปหน้าร้าน
            </Link>

            <div className="grid lg:grid-cols-2 gap-10">
                {/* รูปสินค้า — รูปใหญ่ + แถบรูปย่อ กดเพื่อดูเต็มจอและเลื่อนดูได้ */}
                <div className="lg:sticky lg:top-24 lg:self-start">
                    <ProductGalleryViewer images={gallery} productName={product.name} />
                </div>

                {/* ข้อมูลและปุ่มสั่งซื้อ */}
                <div className="space-y-7">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={PRODUCT_TYPE_TONE[product.type]}>{PRODUCT_TYPE_LABEL[product.type]}</Badge>
                            {product.event && (
                                <Link
                                    href={eventHref(product.event)}
                                    className="eyebrow text-ink-mute hover:text-ink transition-colors"
                                >
                                    {product.event.title}
                                </Link>
                            )}
                        </div>

                        <h1 className="display text-2xl sm:text-3xl mt-2">{product.name}</h1>
                        <p className="numeral text-3xl sm:text-4xl mt-3">
                            {min === max ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`}
                        </p>
                    </div>

                    {!state.ok && (
                        <Notice tone="danger" title="ปิดการขายแล้ว">
                            <p>{state.reason}</p>
                        </Notice>
                    )}

                    {product.type === "PREORDER" && (
                        <Notice tone="move" title="สินค้าพรีออเดอร์">
                            <div className="space-y-1">
                                {product.estimatedShipAt && (
                                    <p className="tnum">กำหนดส่งโดยประมาณ {formatDate(product.estimatedShipAt)}</p>
                                )}
                                {product.preorderCloseAt && (
                                    <p className="tnum">ปิดรับพรีออเดอร์ {formatDate(product.preorderCloseAt)}</p>
                                )}
                                {product.preorderNote && <p>{product.preorderNote}</p>}
                                <p>สินค้าพรีออเดอร์จะถูกแยกเป็นออเดอร์ต่างหากจากสินค้าพร้อมส่ง เพราะรอบจัดส่งต่างกัน</p>
                            </div>
                        </Notice>
                    )}

                    <AddToCart
                        variants={options}
                        maxPerOrder={product.maxPerOrder}
                        isLoggedIn={!!session?.user}
                    />

                    <div className="rounded-2xl bg-paper border border-line p-5 space-y-2">
                        <p className="eyebrow">วิธีรับของ</p>
                        <ul className="text-[13px] text-ink-soft space-y-1">
                            {product.allowPickup && (
                                <li>
                                    · {DELIVERY_LABEL.PICKUP} — ไม่มีค่าใช้จ่าย
                                    {setting.pickupLocation && (
                                        <span className="text-ink-mute"> ({setting.pickupLocation})</span>
                                    )}
                                </li>
                            )}
                            {product.allowShipping && (
                                <li className="tnum">
                                    · {DELIVERY_LABEL.SHIPPING} — ชิ้นแรก {formatBaht(setting.shippingBaseFee)}{" "}
                                    ชิ้นถัดไปบวกชิ้นละ {formatBaht(setting.shippingExtraPerItem)}
                                </li>
                            )}
                        </ul>
                    </div>
                </div>
            </div>

            <section className="max-w-3xl">
                <p className="eyebrow mb-3">รายละเอียดสินค้า</p>
                <RichText className="text-[15px]">{product.description}</RichText>
            </section>
        </div>
    )
}

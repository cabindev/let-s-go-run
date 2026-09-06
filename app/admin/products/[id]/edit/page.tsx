import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { ProductForm } from "@/components/admin/ProductForm"
import { VariantManager } from "@/components/admin/VariantManager"
import { ProductGallery } from "@/components/admin/ProductGallery"

export const dynamic = "force-dynamic"

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const product = await prisma.product.findUnique({ where: { id } })
    if (!product) notFound()

    const [variants, images, events] = await Promise.all([
        prisma.productVariant.findMany({
            where: { productId: id },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            include: { _count: { select: { orderItems: true } } },
        }),
        prisma.productImage.findMany({
            where: { productId: id },
            orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
        }),
        prisma.event.findMany({ orderBy: { date: "desc" }, select: { id: true, title: true }, take: 100 }),
    ])

    return (
        <div className="max-w-2xl mx-auto space-y-12">
            <div>
                <Link
                    href="/admin/products"
                    className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                    สินค้า
                </Link>
                <div className="flex items-end justify-between gap-4 mt-4">
                    <h1 className="display text-2xl sm:text-3xl">แก้ไขสินค้า</h1>
                    <Link
                        href={`/shop/${product.slug}`}
                        target="_blank"
                        className="eyebrow text-ink-soft hover:text-ink transition-colors shrink-0 pb-2"
                    >
                        ดูหน้าจริง
                    </Link>
                </div>
            </div>

            <VariantManager productId={product.id} productPrice={product.price} variants={variants} />

            <div className="border-t border-line pt-10">
                <ProductGallery productId={product.id} status={product.status} images={images} />
            </div>

            <div className="border-t border-line pt-10">
                <ProductForm product={product} events={events} />
            </div>
        </div>
    )
}

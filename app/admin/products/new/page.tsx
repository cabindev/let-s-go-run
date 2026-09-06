import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { ProductForm } from "@/components/admin/ProductForm"

export const dynamic = "force-dynamic"

export default async function NewProductPage() {
    // ให้เลือกผูกสินค้ากับงานวิ่งได้ (ไม่บังคับ) — เรียงงานล่าสุดขึ้นก่อน
    const events = await prisma.event.findMany({
        orderBy: { date: "desc" },
        select: { id: true, title: true },
        take: 100,
    })

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
                <h1 className="display text-2xl sm:text-3xl mt-4">เพิ่มสินค้า</h1>
            </div>

            <ProductForm events={events} />
        </div>
    )
}

import { Suspense } from "react"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth-helpers"
import { buildEventWhere, EVENT_INCLUDE } from "@/lib/event-query"
import { Card } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { EventSearch } from "@/components/events/EventSearch"
import { EventListCard } from "@/components/events/EventListCard"
import { EventTabs } from "@/components/events/EventTabs"
import { ProductCard } from "@/components/shop/ProductCard"
import { SHOP_NAME } from "@/lib/shop"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function HomePage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; province?: string; distance?: string; filter?: string; type?: string }>
}) {
    const sp = await searchParams
    const session = await getSession()

    const events = await prisma.event.findMany({
        where: buildEventWhere(sp),
        orderBy: { createdAt: "desc" },
        include: EVENT_INCLUDE,
        take: 60,
    })

    const hasSearch = !!(sp.q || sp.province || sp.distance || sp.type)

    return (
        <>
            {/*
              ส่วนหัว — ช่องค้นหาย้ายไปอยู่กลางแถบบนแล้วตั้งแต่จอ lg ขึ้นไป
              ที่เหลือไว้ตรงนี้คือช่องค้นหาสำหรับจอเล็ก กับข้อความแนะนำระบบสำหรับคนที่ยังไม่ล็อกอิน
              คนที่ล็อกอินแล้วบนจอคอมจึงเจอการ์ดงานวิ่งทันทีใต้แถบบน (สถิติย้ายเข้าเมนูผู้ใช้)
            */}
            <section className={cn("bg-paper border-b border-line", session?.user && "lg:hidden")}>
                <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6 sm:py-8 space-y-5">
                    {!session?.user && (
                        <div className="max-w-xl">
                            <p className="eyebrow">ระบบรับสมัครงานวิ่ง</p>
                            <h1 className="display text-[clamp(1.4rem,3vw,1.875rem)] mt-1">
                                หางานวิ่งที่ใช่ แล้วสมัครได้เลย
                            </h1>
                            <p className="text-ink-soft text-[15px] mt-1.5">
                                ค้นหาจากชื่องานหรือระยะทาง เลือกประเภทที่ต้องการ แล้วสมัครผ่านระบบได้ทันที
                            </p>
                        </div>
                    )}

                    <div className="lg:hidden">
                        <Suspense fallback={<div className="h-[60px] rounded-3xl bg-paper-2 animate-pulse" />}>
                            <EventSearch />
                        </Suspense>
                    </div>
                </div>
            </section>

            {/* ───── รายการงานวิ่ง ───── */}
            <section className="max-w-6xl mx-auto px-5 sm:px-8 py-7 sm:py-9 space-y-5">
                <SectionHeading title="งานวิ่ง" count={events.length > 0 ? `${events.length} งาน` : undefined} />

                <Suspense fallback={null}>
                    <EventTabs />
                </Suspense>

                {events.length === 0 ? (
                    <Card>
                        <EmptyState
                            title={hasSearch ? "ไม่พบงานที่ตรงกับที่ค้นหา" : "ยังไม่มีงานวิ่งในหมวดนี้"}
                            description={hasSearch ? "ลองเปลี่ยนคำค้นหา จังหวัด หรือระยะทาง" : "กลับมาดูใหม่อีกครั้งเร็ว ๆ นี้"}
                        />
                    </Card>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {events.map((e) => <EventListCard key={e.id} event={e} />)}
                    </div>
                )}
            </section>

            {/* ───── เสื้อและของที่ระลึก ───── */}
            <Suspense fallback={null}>
                <ShopStrip />
            </Suspense>
        </>
    )
}

/**
 * แถบสินค้าบนหน้าแรก — โชว์ของล่าสุดไม่กี่ชิ้นแล้วลิงก์ไปหน้าร้านเต็ม
 * ไม่แสดงอะไรเลยถ้ายังไม่มีสินค้าเปิดขาย เพื่อไม่ให้หน้าแรกมีหัวข้อว่างๆ
 */
async function ShopStrip() {
    const products = await prisma.product.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        include: {
            variants: { where: { active: true }, orderBy: { sortOrder: "asc" } },
            // ดึงมาไม่กี่รูปแล้วให้ coverImage() เลือก "ด้านหน้า" เป็นปก
            images: { orderBy: [{ category: "asc" }, { sortOrder: "asc" }], take: 4 },
            event: { select: { title: true } },
        },
        take: 4,
    })

    // สินค้าที่ปิดรับพรีออเดอร์แล้วยังโชว์อยู่ พร้อมป้ายบอกสถานะบนการ์ด — เหมือนหน้าร้าน
    if (products.length === 0) return null

    return (
        <section className="border-t border-line bg-paper">
            <div className="max-w-6xl mx-auto px-5 sm:px-8 py-7 sm:py-9 space-y-5">
                <SectionHeading
                    title="สินค้าและของที่ระลึก"
                    description={`${SHOP_NAME} · เลือกไซส์ ใส่ตะกร้า แล้วชำระเงินผ่านระบบได้ทันที รับเองหรือส่งไปรษณีย์ก็ได้`}
                    href="/shop"
                    linkLabel="ดูสินค้าทั้งหมด"
                />
                <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                    {products.map((p) => <ProductCard key={p.id} product={p} compact />)}
                </div>
            </div>
        </section>
    )
}

/**
 * หัวข้อของแต่ละส่วนบนหน้าแรก
 *
 * ของเดิมใช้ .eyebrow — ตัวอักษร 11px สีเทาพิมพ์ใหญ่ ซึ่งออกแบบไว้เป็นป้ายกำกับช่องกรอก
 * ไม่ใช่หัวข้อ พอเอามาคั่นระหว่างสองส่วนใหญ่ของหน้าแรกเลยแทบมองไม่เห็นว่าตรงไหนคืองานวิ่ง
 * ตรงไหนคือสินค้า
 */
function SectionHeading({
    title, count, description, href, linkLabel,
}: {
    title: string
    count?: string
    description?: string
    href?: string
    linkLabel?: string
}) {
    return (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div className="flex items-baseline gap-3 min-w-0">
                <h2 className="display text-lg sm:text-xl">{title}</h2>
                {count && <span className="text-[13px] text-ink-mute tnum shrink-0">{count}</span>}
            </div>
            {href && linkLabel && (
                <Link
                    href={href}
                    className="text-[14px] font-semibold text-ink-mute hover:text-ink transition-colors shrink-0"
                >
                    {linkLabel}
                </Link>
            )}
            {description && (
                <p className="w-full text-[14px] text-ink-mute">{description}</p>
            )}
        </div>
    )
}

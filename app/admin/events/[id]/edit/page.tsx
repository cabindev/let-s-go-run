import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { eventHref } from "@/lib/events"
import { EventForm } from "@/components/admin/EventForm"
import { CategoryManager } from "@/components/admin/CategoryManager"
import { GalleryManager } from "@/components/admin/GalleryManager"

export const dynamic = "force-dynamic"

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const event = await prisma.event.findUnique({ where: { id } })
    if (!event) notFound()

    const [categories, images] = await Promise.all([
        prisma.raceCategory.findMany({
            where: { eventId: id },
            orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
            include: { _count: { select: { registrations: true } } },
        }),
        prisma.eventImage.findMany({ where: { eventId: id }, orderBy: { sortOrder: "asc" } }),
    ])

    return (
        <div className="max-w-2xl mx-auto space-y-12">
            <div>
                <Link href="/admin/events" className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors">
                    <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                    กิจกรรม
                </Link>
                <div className="flex items-end justify-between gap-4 mt-4">
                    <h1 className="display text-2xl sm:text-3xl">แก้ไขกิจกรรม</h1>
                    <Link href={eventHref(event)} target="_blank" className="eyebrow text-ink-soft hover:text-ink transition-colors shrink-0 pb-2">
                        ดูหน้าจริง
                    </Link>
                </div>
            </div>

            <CategoryManager eventId={event.id} categories={categories} />

            <div className="border-t border-line pt-10">
                <GalleryManager eventId={event.id} images={images} />
            </div>

            <div className="border-t border-line pt-10">
                <EventForm event={event} />
            </div>
        </div>
    )
}

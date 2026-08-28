import Link from "next/link"
import type { Event, RaceCategory } from "@prisma/client"
import { Badge, EventStatusBadge } from "@/components/ui/Badge"
import { EVENT_TYPE_LABEL, distances, headlineDistance, priceRange } from "@/lib/events"
import { formatDateRange, formatPrice } from "@/lib/utils"

/**
 * การ์ดในรายการงานวิ่ง — โครงข้อมูลเดียวกับ race.thai.run
 * ชื่องาน / ช่วงวันที่ / ประเภท (วิ่งในงาน–วิ่งที่ไหนก็ได้) / จัดโดย
 */
export function EventListCard({ event }: { event: Event & { categories: RaceCategory[]; _count?: { registrations: number } } }) {
    const dists = distances(event, event.categories)
    const { min, max } = priceRange(event, event.categories)

    return (
        <Link
            href={event.type === "VIRTUAL" ? `/virtual/${event.id}` : `/events/${event.id}`}
            className="group flex gap-4 sm:gap-5 bg-paper border border-line rounded-3xl p-4 hover:border-ink-mute transition-colors"
        >
            {/* ภาพปก */}
            <div className="relative w-28 sm:w-44 shrink-0 aspect-[4/3] rounded-2xl overflow-hidden bg-paper-3">
                {event.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={event.image}
                        alt=""
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                    />
                ) : (
                    <span className="absolute inset-0 flex items-center justify-center numeral text-2xl sm:text-4xl text-ink-mute/30">
                        {headlineDistance(event, event.categories)}
                    </span>
                )}
            </div>

            {/* เนื้อหา */}
            <div className="min-w-0 flex-1 flex flex-col">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <EventStatusBadge status={event.status} date={event.type === "VIRTUAL" ? (event.endDate ?? event.date) : event.date} />
                    <Badge tone="outline">{EVENT_TYPE_LABEL[event.type]}</Badge>
                </div>

                <h3 className="display text-base sm:text-lg line-clamp-2 group-hover:text-ink-soft transition-colors">
                    {event.title}
                </h3>

                <p className="text-[13px] text-ink-soft mt-1.5 tnum">
                    {formatDateRange(event.date, event.endDate)}
                </p>

                {event.organizer && (
                    <p className="text-[12px] text-ink-mute mt-0.5 truncate">จัดโดย {event.organizer}</p>
                )}

                <div className="mt-auto pt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 tnum">
                    <span className="text-sm font-semibold">
                        {min === max ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`}
                    </span>
                    <span className="text-[12px] text-ink-mute">
                        {dists.length === 1 ? `${dists[0]} กม.` : `${dists.join(" / ")} กม.`}
                    </span>
                    {event._count && (
                        <span className="text-[12px] text-ink-mute ml-auto">
                            {event._count.registrations}
                            {event.maxParticipants ? `/${event.maxParticipants}` : ""} คน
                        </span>
                    )}
                </div>
            </div>
        </Link>
    )
}

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { EventType } from "@prisma/client"
import { EventForm } from "@/components/admin/EventForm"

export const dynamic = "force-dynamic"

export default async function NewEventPage({
    searchParams,
}: {
    searchParams: Promise<{ type?: string }>
}) {
    const { type } = await searchParams
    const defaultType: EventType = type === "VIRTUAL" ? "VIRTUAL" : "ONSITE"

    return (
        <div className="max-w-2xl mx-auto space-y-10">
            <div>
                <Link href="/admin/events" className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors">
                    <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                    กิจกรรม
                </Link>
                <h1 className="display text-2xl sm:text-3xl mt-3">
                    {defaultType === "VIRTUAL" ? "สร้างงานวิ่งสะสมระยะ" : "สร้างงานวิ่งใหม่"}
                </h1>
            </div>
            <EventForm defaultType={defaultType} />
        </div>
    )
}

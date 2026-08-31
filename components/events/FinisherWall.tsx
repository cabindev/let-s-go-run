import Link from "next/link"
import type { WallRow } from "@/lib/vr"
import { Avatar } from "@/components/ui/Avatar"
import { Badge } from "@/components/ui/Badge"
import { Bar } from "@/components/ui/Rings"
import { EmptyState } from "@/components/ui/EmptyState"
import { cn, formatDate, formatNumber } from "@/lib/utils"

/** กระดานผู้สะสมระยะของงาน VIRTUAL — เรียงตาม % ของเป้าหมาย */
export function FinisherWall({
    rows,
    myRegistrationId,
}: {
    rows: WallRow[]
    myRegistrationId?: string | null
}) {
    if (rows.length === 0) {
        return <EmptyState title="ยังไม่มีใครส่งผล" description="เป็นคนแรกที่ส่งผลวิ่งของงานนี้" />
    }

    return (
        <ul className="divide-y divide-line">
            {rows.map((r) => {
                const isMe = r.registrationId === myRegistrationId
                return (
                    <li
                        key={r.registrationId}
                        className={cn("py-4", isMe && "-mx-4 px-4 bg-paper border border-line rounded-2xl")}
                    >
                        <div className="flex items-center gap-3">
                            {r.rank === 1 ? (
                                <span className="w-8 h-8 shrink-0 rounded-full bg-move flex items-center justify-center numeral text-sm text-ink">
                                    {r.rank}
                                </span>
                            ) : (
                                <span className={cn("w-8 shrink-0 numeral text-lg", r.rank <= 3 ? "text-ink" : "text-ink-mute")}>
                                    {r.rank}
                                </span>
                            )}
                            <Avatar src={r.image} name={r.name} size={38} />

                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold tracking-tight truncate">
                                    {r.name}
                                    {isMe && (
                                        <span className="ml-2 inline-flex items-center text-[11px] font-semibold text-ink bg-move px-2 py-0.5 rounded-full">
                                            คุณ
                                        </span>
                                    )}
                                </p>
                                <p className="text-[11px] text-ink-mute mt-0.5 tnum">
                                    {r.bib && `BIB ${r.bib}`}
                                    {r.bib && r.categoryName && " · "}
                                    {r.categoryName}
                                </p>
                            </div>

                            <div className="text-right shrink-0">
                                <p className={cn("numeral text-base", r.finished && "text-lime")}>
                                    {formatNumber(r.percent, 0)}
                                    <span className="text-[0.62em] font-semibold tracking-normal text-ink-mute ml-0.5">%</span>
                                </p>
                                <p className="text-[11px] text-ink-mute tnum">
                                    {formatNumber(r.total, 2)} / {formatNumber(r.target, 2)} กม.
                                </p>
                            </div>
                        </div>

                        <div className="mt-2.5 pl-11">
                            <Bar value={r.percent} color={r.finished ? "var(--ring-lime)" : "var(--color-ink)"} />
                            <div className="flex items-center justify-between gap-3 mt-1.5">
                                <p className="text-[11px] text-ink-mute tnum">
                                    {r.lastRunDate
                                        ? `ล่าสุด ${formatNumber(r.lastDistance ?? 0, 2)} กม. · ${formatDate(r.lastRunDate)}`
                                        : "ยังไม่ส่งผล"}
                                </p>
                                {r.finished && <Badge tone="lime">ครบเป้าหมาย</Badge>}
                            </div>
                        </div>
                    </li>
                )
            })}
        </ul>
    )
}

/** แท็บกรองตามประเภท (ระยะเป้าหมาย) */
export function WallTabs({
    eventId,
    categories,
    current,
}: {
    eventId: string
    categories: { id: string; name: string }[]
    current?: string | null
}) {
    if (categories.length === 0) return null

    const tab = (href: string, label: string, active: boolean) => (
        <Link
            key={href}
            href={href}
            className={cn(
                "shrink-0 px-4 h-9 inline-flex items-center rounded-full text-[13px] font-semibold tracking-tight transition-colors",
                active ? "bg-ink text-white" : "bg-paper border border-line text-ink-soft hover:text-ink"
            )}
        >
            {label}
        </Link>
    )

    return (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0">
            {tab(`/virtual/${eventId}`, "ทุกประเภท", !current)}
            {categories.map((c) => tab(`/virtual/${eventId}?cat=${c.id}`, c.name, current === c.id))}
        </div>
    )
}

import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth-helpers"
import { getLevel } from "@/lib/levels"
import { Card } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { EmptyState } from "@/components/ui/EmptyState"
import { cn, formatNumber } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: "อันดับ · RunLudtong" }

export default async function LeaderboardPage() {
    const session = await getSession()

    const users = await prisma.user.findMany({
        where: { totalDistance: { gt: 0 } },
        orderBy: { totalDistance: "desc" },
        take: 100,
        select: {
            id: true, name: true, email: true, image: true, totalDistance: true,
            _count: { select: { registrations: { where: { status: "PAID" } } } },
        },
    })

    const inList = session?.user ? users.some((u) => u.id === session.user.id) : false

    return (
        <div className="pt-4 space-y-10">
            <div>
                <p className="eyebrow">จัดอันดับจากระยะทางสะสมของกิจกรรมที่จบแล้ว</p>
                <h1 className="display text-3xl sm:text-4xl mt-2">อันดับนักวิ่ง</h1>
            </div>

            {users.length === 0 ? (
                <Card>
                    <EmptyState
                        title="ยังไม่มีใครบนกระดาน"
                        description="เมื่อมีนักวิ่งจบกิจกรรมแล้ว อันดับจะแสดงที่นี่"
                        actionLabel="ดูงานวิ่ง"
                        actionHref="/"
                    />
                </Card>
            ) : (
                <ul className="divide-y divide-line">
                    {users.map((u, i) => {
                        const rank = i + 1
                        const isMe = session?.user?.id === u.id
                        const level = getLevel(u.totalDistance)

                        return (
                            <li key={u.id} className={cn("flex items-center gap-4 py-4", isMe && "-mx-4 px-4 bg-paper border border-line rounded-2xl")}>
                                {rank === 1 ? (
                                    <span className="w-8 h-8 shrink-0 rounded-full bg-move flex items-center justify-center numeral text-sm text-ink">
                                        {rank}
                                    </span>
                                ) : (
                                    <span className={cn("w-8 shrink-0 numeral text-lg", rank <= 3 ? "text-ink" : "text-ink-mute")}>
                                        {rank}
                                    </span>
                                )}
                                <Avatar src={u.image} name={u.name} email={u.email} size={40} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold tracking-tight truncate">
                                        {u.name || "นักวิ่ง"}
                                        {isMe && (
                                            <span className="ml-2 inline-flex items-center text-[11px] font-semibold text-ink bg-move px-2 py-0.5 rounded-full">
                                                คุณ
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-[11px] text-ink-mute mt-0.5 tnum">
                                        {level.current.name} · {u._count.registrations} กิจกรรม
                                    </p>
                                </div>
                                <p className="numeral text-base shrink-0">
                                    {formatNumber(u.totalDistance, 1)}
                                    <span className="text-[0.62em] font-semibold tracking-normal text-ink-mute ml-1">กม.</span>
                                </p>
                            </li>
                        )
                    })}
                </ul>
            )}

            {session?.user && !inList && (
                <Card className="p-6 text-center">
                    <p className="text-sm text-ink-soft">คุณยังไม่อยู่บนกระดาน — เข้าร่วมกิจกรรมให้สำเร็จเพื่อเริ่มสะสมระยะทาง</p>
                    <Link href="/" className="eyebrow inline-block mt-3 text-ink hover:text-ink-soft">
                        ดูงานวิ่ง
                    </Link>
                </Card>
            )}
        </div>
    )
}

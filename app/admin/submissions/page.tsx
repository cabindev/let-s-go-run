import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { deleteSubmissionAsAdmin } from "@/app/actions/submission"
import { Card } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { EmptyState } from "@/components/ui/EmptyState"
import { ConfirmAction } from "@/components/ui/ConfirmAction"
import { formatDate, formatNumber, formatTime } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function AdminSubmissionsPage() {
    const submissions = await prisma.runSubmission.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
            registration: {
                include: {
                    user: { select: { name: true, email: true, image: true } },
                    event: { select: { id: true, title: true } },
                    category: { select: { name: true } },
                },
            },
        },
    })

    return (
        <div className="space-y-10">
            <div>
                <p className="eyebrow">ผลวิ่งของงานแบบสะสมระยะ · ขึ้นทันทีที่ส่ง ลบได้ถ้าพบว่าไม่ถูกต้อง</p>
                <h1 className="display text-3xl sm:text-4xl mt-2">ผลวิ่งที่ส่งเข้ามา</h1>
            </div>

            {submissions.length === 0 ? (
                <Card>
                    <EmptyState title="ยังไม่มีผลวิ่งที่ส่งเข้ามา" description="เมื่อผู้สมัครงานแบบสะสมระยะส่งผล รายการจะแสดงที่นี่" />
                </Card>
            ) : (
                <ul className="divide-y divide-line">
                    {submissions.map((s) => (
                        <li key={s.id} className="flex items-center gap-4 py-4">
                            {s.evidenceUrl ? (
                                <a href={s.evidenceUrl} target="_blank" rel="noreferrer" className="shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={s.evidenceUrl} alt="" className="w-14 h-14 rounded-xl object-cover border border-line" />
                                </a>
                            ) : (
                                <span className="w-14 h-14 rounded-xl bg-paper-2 border border-line shrink-0 flex items-center justify-center text-[10px] text-ink-mute text-center px-1">
                                    ไม่มี<br />หลักฐาน
                                </span>
                            )}

                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <Avatar src={s.registration.user.image} name={s.registration.user.name} email={s.registration.user.email} size={22} />
                                    <p className="text-sm font-semibold tracking-tight truncate">
                                        {s.registration.fullName || s.registration.user.name || s.registration.user.email}
                                    </p>
                                    {s.registration.bib && (
                                        <span className="text-[11px] text-ink-mute tnum shrink-0">BIB {s.registration.bib}</span>
                                    )}
                                </div>
                                <Link
                                    href={`/virtual/${s.registration.event.id}`}
                                    target="_blank"
                                    className="text-[11px] text-ink-mute hover:text-ink transition-colors truncate block mt-0.5"
                                >
                                    {s.registration.event.title}
                                    {s.registration.category && ` · ${s.registration.category.name}`}
                                </Link>
                                <p className="text-[11px] text-ink-mute tnum mt-0.5">
                                    วิ่งวันที่ {formatDate(s.runDate)} · ส่งเมื่อ {formatDate(s.createdAt)} {formatTime(s.createdAt)}
                                </p>
                                {s.note && <p className="text-[11px] text-ink-mute truncate">{s.note}</p>}
                            </div>

                            <p className="numeral text-lg shrink-0">
                                {formatNumber(s.distance, 2)}
                                <span className="text-[0.55em] font-semibold tracking-normal text-ink-mute ml-1">กม.</span>
                            </p>

                            <ConfirmAction
                                action={deleteSubmissionAsAdmin.bind(null, s.id)}
                                title="ลบผลนี้?"
                                message={`ผล ${formatNumber(s.distance, 2)} กม. จะถูกลบออกจากระยะสะสมของผู้สมัคร`}
                                confirmLabel="ลบ"
                                className="eyebrow text-ink-mute hover:text-danger transition-colors shrink-0"
                            >
                                ลบ
                            </ConfirmAction>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

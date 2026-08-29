import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth-helpers"
import { Notice } from "@/components/ui/Badge"
import { SubmitRunForm } from "@/components/events/SubmitRunForm"
import { submissionWindow, submitState, targetOf } from "@/lib/vr"
import { formatDateInput, formatDateRange } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: "ส่งผลวิ่ง · Run Club" }

export default async function SubmitPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const user = await requireUser()

    const event = await prisma.event.findUnique({ where: { id } })
    if (!event) notFound()
    if (event.type !== "VIRTUAL") redirect(`/events/${id}`)

    const reg = await prisma.registration.findUnique({
        where: { userId_eventId: { userId: user.id, eventId: id } },
        include: {
            category: { select: { distance: true } },
            submissions: { orderBy: [{ runDate: "desc" }, { createdAt: "desc" }] },
        },
    })

    // ยังไม่ได้สมัคร หรือยังไม่จ่าย — พาไปหน้าที่ควรอยู่
    if (!reg || reg.status === "CANCELLED") redirect(`/virtual/${id}`)
    if (reg.status === "PENDING") redirect(`/payment/${reg.id}`)

    const state = submitState(event)
    const { start, end } = submissionWindow(event)
    const target = targetOf({ category: reg.category, event })
    const total = reg.submissions.reduce((s, x) => s + x.distance, 0)

    return (
        <div className="pt-4 max-w-2xl mx-auto space-y-8">
            <Link
                href={`/virtual/${id}`}
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors"
            >
                <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                กลับไปหน้างาน
            </Link>

            <div>
                <p className="eyebrow">ส่งผลวิ่ง{reg.bib ? ` · BIB ${reg.bib}` : ""}</p>
                <h1 className="display text-2xl sm:text-3xl mt-2">{event.title}</h1>
                <p className="text-[13px] text-ink-mute mt-2 tnum">
                    ส่งผลได้ระหว่าง {formatDateRange(event.date, event.endDate)}
                </p>
            </div>

            {state.open ? (
                <SubmitRunForm
                    registrationId={reg.id}
                    target={target}
                    total={total}
                    submissions={reg.submissions}
                    minDate={formatDateInput(start)}
                    maxDate={formatDateInput(new Date() < end ? new Date() : end)}
                    finished={target > 0 && total >= target}
                />
            ) : (
                <Notice tone="move" title="ส่งผลไม่ได้ในตอนนี้">{state.reason}</Notice>
            )}
        </div>
    )
}

import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { heldSeatWhere, expireStaleRegistrations } from "@/lib/expiry"
import { requireUser } from "@/lib/auth-helpers"
import { registerState, toOptions } from "@/lib/events"
import { getTakenSlots } from "@/app/actions/register-flow"
import { RegisterWizard } from "@/components/events/RegisterWizard"

export const dynamic = "force-dynamic"
export const metadata = { title: "สมัครเข้าร่วม · Run Club" }

export default async function RegisterPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const sessionUser = await requireUser()

    // ปล่อยที่นั่งที่หมดเวลา แล้วค่อยตรวจว่าผู้ใช้มีรายการค้างอยู่จริงไหม
    await expireStaleRegistrations()

    const [event, user] = await Promise.all([
        prisma.event.findUnique({
            where: { id },
            include: {
                categories: { orderBy: [{ sortOrder: "asc" }, { price: "asc" }] },
                _count: { select: { registrations: { where: heldSeatWhere() } } },
            },
        }),
        prisma.user.findUnique({ where: { id: sessionUser.id }, select: { name: true, phone: true } }),
    ])

    if (!event) notFound()
    if (event.type === "VIRTUAL") redirect(`/virtual/${id}/register`)

    // สมัครไว้แล้ว — พาไปหน้าที่ควรอยู่จริง
    const existing = await prisma.registration.findUnique({
        where: { userId_eventId: { userId: sessionUser.id, eventId: id } },
        select: { id: true, status: true },
    })
    // ยกเลิกแล้ว หรือหมดเวลาชำระ = ที่นั่งถูกคืนแล้ว สมัครใหม่ได้
    if (existing && !["CANCELLED", "EXPIRED"].includes(existing.status)) {
        if (existing.status === "PENDING" || existing.status === "REJECTED") redirect(`/payment/${existing.id}`)
        redirect(`/events/${id}`)
    }

    // ปิดรับสมัครแล้ว — กลับไปหน้างาน
    const state = registerState(event, event._count.registrations)
    if (!state.open) redirect(`/events/${id}`)

    const taken = await getTakenSlots(id)
    const options = toOptions(event, event.categories).map((o) => ({
        ...o,
        taken: o.id ? (taken[o.id] ?? 0) : event._count.registrations,
    }))

    return (
        <RegisterWizard
            event={{
                id: event.id,
                title: event.title,
                date: event.date.toISOString(),
                endDate: event.endDate?.toISOString() ?? null,
                location: event.location,
                image: event.image,
                type: "ONSITE",
            }}
            options={options}
            defaults={{ fullName: user?.name ?? "", phone: user?.phone ?? "" }}
        />
    )
}

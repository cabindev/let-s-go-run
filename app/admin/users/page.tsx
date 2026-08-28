import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/auth-helpers"
import { getLevel } from "@/lib/levels"
import { Card } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { EmptyState } from "@/components/ui/EmptyState"
import { RoleToggle } from "@/components/admin/RoleToggle"
import { formatDate, formatNumber } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function AdminUsersPage() {
    const me = await requireAdminPage()

    const users = await prisma.user.findMany({
        orderBy: [{ role: "asc" }, { createdAt: "desc" }],
        include: { _count: { select: { registrations: { where: { status: "PAID" } } } } },
    })

    const admins = users.filter((u) => u.role === "ADMIN").length

    return (
        <div className="space-y-10">
            <div>
                <p className="eyebrow tnum">{users.length} คน · แอดมิน {admins} คน</p>
                <h1 className="display text-3xl sm:text-4xl mt-2">ผู้ใช้งาน</h1>
            </div>

            {users.length === 0 ? (
                <Card><EmptyState title="ยังไม่มีผู้ใช้งาน" /></Card>
            ) : (
                <ul className="divide-y divide-line">
                    {users.map((u) => {
                        const level = getLevel(u.totalDistance)
                        return (
                            <li key={u.id} className="flex items-center gap-4 py-4">
                                <Avatar src={u.image} name={u.name} email={u.email} size={42} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold tracking-tight truncate">{u.name || "ไม่ระบุชื่อ"}</p>
                                    <p className="text-[11px] text-ink-mute truncate">{u.email}</p>
                                    <p className="text-[11px] text-ink-mute mt-0.5 tnum">
                                        {level.current.name} · {formatNumber(u.totalDistance, 1)} กม. ·{" "}
                                        {u._count.registrations} กิจกรรม · สมัคร {formatDate(u.createdAt)}
                                    </p>
                                </div>
                                <div className="shrink-0">
                                    <RoleToggle userId={u.id} role={u.role} disabled={u.id === me.id} />
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}

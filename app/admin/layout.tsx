import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/auth-helpers"
import { AdminShell } from "@/components/admin/AdminShell"

export const dynamic = "force-dynamic"
export const metadata = { title: "หลังบ้าน · Run Club" }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    await requireAdminPage()
    const pendingSlips = await prisma.registration.count({ where: { status: "WAITING" } })

    return <AdminShell pendingSlips={pendingSlips}>{children}</AdminShell>
}

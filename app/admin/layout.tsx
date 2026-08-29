import { requireAdminPage } from "@/lib/auth-helpers"
import { AdminShell } from "@/components/admin/AdminShell"

export const dynamic = "force-dynamic"
export const metadata = { title: "หลังบ้าน · Run Club" }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    await requireAdminPage()

    return <AdminShell>{children}</AdminShell>
}

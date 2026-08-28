import { Sidebar } from "@/components/layout/Sidebar"
import { Topbar } from "@/components/layout/Topbar"
import { MobileNav } from "@/components/layout/MobileNav"

export const dynamic = "force-dynamic"

export default function MainLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-paper-2">
            <Sidebar />
            <div className="lg:pl-60">
                <Topbar />
                <main className="max-w-5xl mx-auto px-5 sm:px-8 pb-32 lg:pb-16">{children}</main>
            </div>
            <MobileNav />
        </div>
    )
}

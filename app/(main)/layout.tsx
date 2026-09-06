import { Sidebar } from "@/components/layout/Sidebar"
import { Topbar } from "@/components/layout/Topbar"
import { MobileNav } from "@/components/layout/MobileNav"
import { currentCartCount } from "@/lib/cart-count"

export const dynamic = "force-dynamic"

export default async function MainLayout({ children }: { children: React.ReactNode }) {
    const cartCount = await currentCartCount()

    return (
        <div className="min-h-screen bg-paper-2">
            <Sidebar cartCount={cartCount} />
            <div className="lg:pl-60">
                <Topbar cartCount={cartCount} />
                <main className="max-w-5xl mx-auto px-5 sm:px-8 pb-32 lg:pb-16">{children}</main>
            </div>
            <MobileNav cartCount={cartCount} />
        </div>
    )
}

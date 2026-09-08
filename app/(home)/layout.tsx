import { PublicHeader } from "@/components/layout/PublicHeader"
import { Footer } from "@/components/layout/Footer"
import { MobileNav } from "@/components/layout/MobileNav"
import { currentCartCount } from "@/lib/cart-count"
import { currentUserSummary } from "@/lib/user-summary"

export const dynamic = "force-dynamic"

/** หน้าแรกใช้เลย์เอาต์เต็มความกว้าง ไม่มี sidebar เพื่อให้โฟกัสที่การเลือกงานวิ่ง */
export default async function HomeLayout({ children }: { children: React.ReactNode }) {
    const [cartCount, summary] = await Promise.all([currentCartCount(), currentUserSummary()])

    return (
        <div className="min-h-screen flex flex-col bg-paper-2">
            <PublicHeader cartCount={cartCount} summary={summary} />
            <main className="flex-1">{children}</main>
            <Footer />
            <div className="lg:hidden h-16" aria-hidden />
            <MobileNav cartCount={cartCount} />
        </div>
    )
}

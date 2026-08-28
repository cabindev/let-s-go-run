import { PublicHeader } from "@/components/layout/PublicHeader"
import { Footer } from "@/components/layout/Footer"
import { MobileNav } from "@/components/layout/MobileNav"

export const dynamic = "force-dynamic"

/** หน้าแรกใช้เลย์เอาต์เต็มความกว้าง ไม่มี sidebar เพื่อให้โฟกัสที่การเลือกงานวิ่ง */
export default function HomeLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex flex-col bg-paper-2">
            <PublicHeader />
            <main className="flex-1">{children}</main>
            <Footer />
            <div className="lg:hidden h-16" aria-hidden />
            <MobileNav />
        </div>
    )
}

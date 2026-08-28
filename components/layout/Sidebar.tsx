'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { NAV_ITEMS, isActive } from "./nav-items"
import { Wordmark } from "./Wordmark"
import { Avatar } from "@/components/ui/Avatar"
import { cn } from "@/lib/utils"

export function Sidebar() {
    const pathname = usePathname()
    const { data: session, status } = useSession()
    const isAdmin = session?.user?.role === "ADMIN"

    return (
        <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 bg-paper border-r border-line">
            <div className="h-20 flex items-center px-7">
                <Wordmark />
            </div>

            <nav className="flex-1 px-4 py-2">
                <ul className="space-y-0.5">
                    {NAV_ITEMS.map((item) => {
                        const active = isActive(pathname, item.href)
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3.5 px-3 py-3 rounded-2xl text-sm font-semibold tracking-tight transition-colors",
                                        active ? "bg-ink text-white" : "text-ink-soft hover:bg-paper-2 hover:text-ink"
                                    )}
                                >
                                    <item.icon className="w-5 h-5" strokeWidth={active ? 2.4 : 1.8} />
                                    {item.name}
                                </Link>
                            </li>
                        )
                    })}
                </ul>

                {isAdmin && (
                    <div className="mt-8 pt-6 border-t border-line">
                        <p className="eyebrow px-3 mb-2">ผู้ดูแลระบบ</p>
                        <Link
                            href="/admin"
                            className="block px-3 py-2.5 rounded-2xl text-sm font-semibold tracking-tight text-ink-soft hover:bg-paper-2 hover:text-ink transition-colors"
                        >
                            หลังบ้าน
                        </Link>
                    </div>
                )}
            </nav>

            <div className="p-4 border-t border-line">
                {status === "loading" ? (
                    <div className="h-14 rounded-2xl bg-paper-2 animate-pulse" />
                ) : session?.user ? (
                    <div>
                        <Link href="/profile" className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-paper-2 transition-colors">
                            <Avatar src={session.user.image} name={session.user.name} email={session.user.email} size={36} />
                            <span className="min-w-0">
                                <span className="block text-[13px] font-semibold truncate text-ink">{session.user.name || "นักวิ่ง"}</span>
                                <span className="block text-[11px] text-ink-mute truncate">{session.user.email}</span>
                            </span>
                        </Link>
                        <button
                            type="button"
                            onClick={() => signOut({ callbackUrl: "/" })}
                            className="w-full text-left px-3 py-2.5 mt-1 rounded-2xl text-[13px] font-semibold text-ink-mute hover:text-move hover:bg-paper-2 transition-colors"
                        >
                            ออกจากระบบ
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <Link
                            href="/auth/signin"
                            className="flex items-center justify-center w-full h-12 rounded-full bg-ink text-white text-sm font-semibold tracking-tight hover:bg-ink-soft transition-colors"
                        >
                            เข้าสู่ระบบ
                        </Link>
                        <Link
                            href="/auth/signup"
                            className="flex items-center justify-center w-full h-12 rounded-full border border-line text-sm font-semibold tracking-tight text-ink hover:bg-paper-2 transition-colors"
                        >
                            สมัครสมาชิก
                        </Link>
                    </div>
                )}
            </div>
        </aside>
    )
}

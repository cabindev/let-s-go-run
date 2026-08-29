'use client'

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { X, Menu } from "lucide-react"
import { Wordmark } from "@/components/layout/Wordmark"
import { cn } from "@/lib/utils"

const LINKS = [
    { href: "/admin", label: "ภาพรวม", exact: true },
    { href: "/admin/events", label: "กิจกรรม" },
    { href: "/admin/registrations", label: "ผู้สมัคร" },
    { href: "/admin/submissions", label: "ผลวิ่ง VR" },
    { href: "/admin/users", label: "ผู้ใช้งาน" },
    { href: "/admin/achievements", label: "ความสำเร็จ" },
]

export function AdminShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const [open, setOpen] = useState(false)

    const nav = (
        <nav className="px-4">
            <ul className="space-y-0.5">
                {LINKS.map((l) => {
                    const active = l.exact ? pathname === l.href : pathname.startsWith(l.href)
                    return (
                        <li key={l.href}>
                            <Link
                                href={l.href}
                                onClick={() => setOpen(false)}
                                className={cn(
                                    "flex items-center justify-between px-3 py-3 rounded-2xl text-sm font-semibold tracking-tight transition-colors",
                                    active ? "bg-ink text-white" : "text-ink-soft hover:bg-paper-2 hover:text-ink"
                                )}
                            >
                                {l.label}
                            </Link>
                        </li>
                    )
                })}
            </ul>

            <div className="mt-8 pt-6 border-t border-line space-y-0.5">
                <Link
                    href="/"
                    onClick={() => setOpen(false)}
                    className="block px-3 py-3 rounded-2xl text-sm font-semibold tracking-tight text-ink-soft hover:bg-paper-2 hover:text-ink transition-colors"
                >
                    กลับหน้าเว็บ
                </Link>
                <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="w-full text-left px-3 py-3 rounded-2xl text-sm font-semibold tracking-tight text-ink-mute hover:text-move hover:bg-paper-2 transition-colors"
                >
                    ออกจากระบบ
                </button>
            </div>
        </nav>
    )

    return (
        <div className="min-h-screen bg-paper-2">
            <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 bg-paper border-r border-line">
                <div className="h-20 flex items-center px-7">
                    <Wordmark sub="Admin" />
                </div>
                <div className="flex-1 overflow-y-auto py-2">{nav}</div>
            </aside>

            <header className="lg:hidden sticky top-0 z-40 h-16 bg-paper/95 backdrop-blur-xl border-b border-line flex items-center justify-between px-5">
                <Wordmark sub="Admin" />
                <button type="button" onClick={() => setOpen(!open)} aria-label="เมนู" className="p-2 -mr-2 text-ink">
                    {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </header>

            {open && (
                <div className="lg:hidden fixed inset-0 z-30 top-16">
                    <div className="absolute inset-0 bg-black/25" onClick={() => setOpen(false)} aria-hidden />
                    <div className="relative bg-paper border-b border-line py-4">{nav}</div>
                </div>
            )}

            <div className="lg:pl-60">
                <main className="px-5 sm:px-8 py-8 lg:py-12 max-w-5xl mx-auto">{children}</main>
            </div>
        </div>
    )
}

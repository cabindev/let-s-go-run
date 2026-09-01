'use client'

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Avatar } from "@/components/ui/Avatar"
import { Wordmark } from "./Wordmark"

/** แถบบนของหน้าแรก — ไม่มี sidebar จึงต้องมีเมนูครบในแถบนี้ */
export function PublicHeader() {
    const { data: session, status } = useSession()
    const pathname = usePathname()
    const [open, setOpen] = useState(false)

    useEffect(() => {
        const close = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest(".user-menu")) setOpen(false)
        }
        document.addEventListener("click", close)
        return () => document.removeEventListener("click", close)
    }, [])

    useEffect(() => setOpen(false), [pathname])

    const isAdmin = session?.user?.role === "ADMIN"

    return (
        <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur-xl border-b border-line">
            <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 lg:h-20 flex items-center justify-between gap-4">
                <Wordmark />

                <nav className="flex items-center gap-1 sm:gap-2">
                    <Link
                        href="/leaderboard"
                        className="hidden sm:inline-flex h-10 px-4 items-center rounded-full text-[15px] font-semibold text-ink-soft hover:text-ink hover:bg-paper-2 transition-colors"
                    >
                        อันดับ
                    </Link>

                    {status === "loading" ? (
                        <div className="w-9 h-9 rounded-full bg-paper-3 animate-pulse" />
                    ) : session?.user ? (
                        <div className="relative user-menu">
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
                                aria-haspopup="menu"
                                aria-expanded={open}
                                aria-label="เมนูผู้ใช้"
                                className="block rounded-full ring-2 ring-transparent hover:ring-line transition-shadow"
                            >
                                <Avatar src={session.user.image} name={session.user.name} email={session.user.email} size={36} />
                            </button>

                            {open && (
                                <div role="menu" className="absolute right-0 mt-3 w-56 bg-paper border border-line rounded-2xl overflow-hidden py-1.5 animate-rise shadow-xl shadow-black/10">
                                    <div className="px-4 py-2.5">
                                        <p className="text-sm font-semibold truncate">{session.user.name || "นักวิ่ง"}</p>
                                        <p className="text-[13px] text-ink-mute truncate">{session.user.email}</p>
                                    </div>
                                    <div className="h-px bg-line mx-4 my-1" />
                                    <Link href="/profile" className="block px-4 py-2.5 text-[15px] font-medium text-ink-soft hover:text-ink hover:bg-paper-2 transition-colors">
                                        โปรไฟล์ของฉัน
                                    </Link>
                                    <Link href="/leaderboard" className="sm:hidden block px-4 py-2.5 text-[15px] font-medium text-ink-soft hover:text-ink hover:bg-paper-2 transition-colors">
                                        อันดับ
                                    </Link>
                                    {isAdmin && (
                                        <Link href="/admin" className="block px-4 py-2.5 text-[15px] font-medium text-ink-soft hover:text-ink hover:bg-paper-2 transition-colors">
                                            หลังบ้าน
                                        </Link>
                                    )}
                                    <div className="h-px bg-line mx-4 my-1" />
                                    <button
                                        type="button"
                                        onClick={() => signOut({ callbackUrl: "/" })}
                                        className="w-full text-left px-4 py-2.5 text-[15px] font-medium text-danger hover:bg-paper-2 transition-colors"
                                    >
                                        ออกจากระบบ
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <Link href="/auth/signin" className="h-10 px-3 sm:px-4 inline-flex items-center rounded-full text-[15px] font-semibold text-ink-soft hover:text-ink hover:bg-paper-2 transition-colors">
                                เข้าสู่ระบบ
                            </Link>
                            <Link href="/auth/signup" className="h-10 px-4 sm:px-5 inline-flex items-center rounded-full bg-ink text-white text-[15px] font-semibold tracking-tight hover:bg-ink-soft transition-colors">
                                สมัครสมาชิก
                            </Link>
                        </>
                    )}
                </nav>
            </div>
        </header>
    )
}

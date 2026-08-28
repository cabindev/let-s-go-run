'use client'

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Avatar } from "@/components/ui/Avatar"
import { Wordmark } from "./Wordmark"

export function Topbar() {
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
        <header className="sticky top-0 z-30 bg-paper-2/85 backdrop-blur-xl border-b border-line">
            <div className="h-16 lg:h-20 px-5 sm:px-8 flex items-center justify-between gap-4 max-w-5xl mx-auto">
                <Wordmark className="lg:invisible" />

                <div className="flex items-center gap-3">
                    {status === "loading" ? (
                        <div className="w-9 h-9 rounded-full bg-paper-3 animate-pulse" />
                    ) : session?.user ? (
                        <div className="relative user-menu">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setOpen(!open)
                                }}
                                aria-haspopup="menu"
                                aria-expanded={open}
                                aria-label="เมนูผู้ใช้"
                                className="block rounded-full ring-2 ring-transparent hover:ring-paper-3 transition-shadow"
                            >
                                <Avatar src={session.user.image} name={session.user.name} email={session.user.email} size={36} />
                            </button>

                            {open && (
                                <div
                                    role="menu"
                                    className="absolute right-0 mt-3 w-56 bg-paper border border-line rounded-2xl overflow-hidden py-1.5 animate-rise shadow-xl shadow-black/10"
                                >
                                    <div className="px-4 py-2.5">
                                        <p className="text-sm font-semibold truncate">{session.user.name || "นักวิ่ง"}</p>
                                        <p className="text-[11px] text-ink-mute truncate">{session.user.email}</p>
                                    </div>
                                    <div className="h-px bg-line mx-4 my-1" />
                                    <Link href="/profile" className="block px-4 py-2.5 text-[13px] font-medium text-ink-soft hover:text-ink hover:bg-paper-2 transition-colors">
                                        โปรไฟล์ของฉัน
                                    </Link>
                                    {isAdmin && (
                                        <Link href="/admin" className="block px-4 py-2.5 text-[13px] font-medium text-ink-soft hover:text-ink hover:bg-paper-2 transition-colors">
                                            หลังบ้าน
                                        </Link>
                                    )}
                                    <div className="h-px bg-line mx-4 my-1" />
                                    <button
                                        type="button"
                                        onClick={() => signOut({ callbackUrl: "/" })}
                                        className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-move hover:bg-paper-2 transition-colors"
                                    >
                                        ออกจากระบบ
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <Link href="/auth/signin" className="text-[13px] font-semibold text-ink-soft hover:text-ink transition-colors px-2">
                                เข้าสู่ระบบ
                            </Link>
                            <Link
                                href="/auth/signup"
                                className="h-10 px-5 inline-flex items-center rounded-full bg-ink text-white text-[13px] font-semibold tracking-tight hover:bg-ink-soft transition-colors"
                            >
                                สมัครสมาชิก
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    )
}

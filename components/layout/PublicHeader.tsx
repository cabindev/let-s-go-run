'use client'

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Wallet } from "lucide-react"
import { Avatar } from "@/components/ui/Avatar"
import { EventSearch } from "@/components/events/EventSearch"
import { CartButton } from "./CartButton"
import { Wordmark } from "./Wordmark"
import type { UserSummary } from "@/lib/user-summary"
import { formatNumber } from "@/lib/utils"

/**
 * แถบบนของหน้าแรก — ไม่มี sidebar จึงต้องมีเมนูครบในแถบนี้
 *
 * ช่องค้นหางานวิ่งฝังอยู่กลางแถบตั้งแต่จอ lg ขึ้นไป เพราะแถบนี้ sticky
 * คนจึงค้นหาใหม่ได้จากทุกตำแหน่งที่เลื่อนไปถึง ไม่ต้องเลื่อนกลับขึ้นหัวหน้า
 * (จอเล็กกว่านั้นไม่มีที่พอใน bar สูง 64px ช่องค้นหาจึงยังอยู่บนตัวหน้าแรกเหมือนเดิม)
 */
export function PublicHeader({ cartCount = 0, summary }: { cartCount?: number; summary?: UserSummary | null }) {
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

                {/* EventSearch อ่าน useSearchParams() จึงต้องมี Suspense คั่นไว้
                    ไม่งั้นหน้าที่ไม่ได้ประกาศ dynamic จะ prerender ไม่ผ่านตอน build */}
                <div className="hidden lg:block flex-1 max-w-md mx-4">
                    <Suspense fallback={<div className="h-11 rounded-full bg-paper-2 border border-line" />}>
                        <EventSearch variant="header" />
                    </Suspense>
                </div>

                <nav className="flex items-center gap-1 sm:gap-2">
                    <Link
                        href="/shop"
                        className="hidden sm:inline-flex h-10 px-4 items-center rounded-full text-[15px] font-semibold text-ink-soft hover:text-ink hover:bg-paper-2 transition-colors"
                    >
                        ร้านค้า
                    </Link>
                    <Link
                        href="/leaderboard"
                        className="hidden sm:inline-flex h-10 px-4 items-center rounded-full text-[15px] font-semibold text-ink-soft hover:text-ink hover:bg-paper-2 transition-colors"
                    >
                        อันดับ
                    </Link>

                    {/* ค้างชำระเป็นเรื่องที่มีเวลานับถอยหลัง (คืนที่นั่งอัตโนมัติใน 24 ชม.)
                        จึงตามคนไปทุกหน้าในแถบบน แทนที่จะโผล่เฉพาะตอนอยู่หัวหน้าแรก */}
                    {summary && summary.pendingPayments > 0 && (
                        <Link
                            href="/profile#registrations"
                            className="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3.5 rounded-full bg-move text-ink text-[13px] font-semibold tracking-tight hover:bg-move/90 transition-colors"
                        >
                            <Wallet className="w-4 h-4 shrink-0" strokeWidth={2.1} />
                            <span className="hidden sm:inline">ชำระเงิน</span>
                            <span className="tnum">{summary.pendingPayments}</span>
                            <span className="hidden sm:inline">รายการ</span>
                        </Link>
                    )}

                    {session?.user && <CartButton count={cartCount} />}

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
                                    {summary && (
                                        <>
                                            <div className="h-px bg-line mx-4 my-1" />
                                            <dl className="px-4 py-1.5 space-y-1.5">
                                                <MenuStat label="ระยะทางรวม" value={`${formatNumber(summary.totalDistance, 1)} กม.`} />
                                                <MenuStat label="กิจกรรมที่จบ" value={formatNumber(summary.completedEvents)} />
                                                <MenuStat label="ระดับ" value={summary.levelName} />
                                                <MenuStat label="อันดับ" value={summary.rank ? `#${summary.rank}` : "—"} />
                                            </dl>
                                        </>
                                    )}
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

/** สถิติหนึ่งบรรทัดในเมนูผู้ใช้ — ป้ายซ้าย ตัวเลขขวา */
function MenuStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <dt className="text-[13px] text-ink-mute">{label}</dt>
            <dd className="text-[13px] font-semibold tnum">{value}</dd>
        </div>
    )
}

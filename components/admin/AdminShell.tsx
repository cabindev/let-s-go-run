'use client'

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { X, Menu } from "lucide-react"
import { Wordmark } from "@/components/layout/Wordmark"
import { cn } from "@/lib/utils"

interface NavLink {
    href: string
    label: string
    exact?: boolean
    /**
     * คำอธิบายใต้ชื่อเมนู — ใส่เฉพาะอันที่ชื่อยังบอกไม่ครบว่าจัดการอะไร
     *
     * ไม่ใส่ทุกอันโดยตั้งใจ ตอนลองใส่ครบเมนูยาวจนต้องเลื่อนถึงจะเจอ "ออกจากระบบ"
     * ซึ่งแย่กว่าเดิม — หัวข้อหมวดทำหน้าที่แยกงานวิ่งกับร้านค้าได้อยู่แล้ว
     */
    hint?: string
}

/**
 * เมนูหลังบ้าน แบ่งเป็นหมวดตาม "ของสองก้อน" ที่ระบบนี้ดูแล
 *
 * งานวิ่งกับร้านค้าเป็นคนละเรื่องกันโดยสิ้นเชิง (คนละตาราง คนละรอบจัดส่ง คนละใบสั่ง)
 * แต่ก่อนหน้านี้เมนูเรียงต่อกันเป็นแถวเดียว 10 อัน ทำให้ "สินค้า" กับ "ผู้สมัคร"
 * ดูเป็นระดับเดียวกัน ทั้งที่คนละระบบ — แยกหัวข้อแล้วมองปราดเดียวรู้ว่าจะไปทางไหน
 *
 * "ทั้งระบบ" คือของที่ใช้ร่วมกันทั้งสองฝั่ง ไม่ได้เป็นของใครโดยเฉพาะ
 */
const NAV_GROUPS: { title: string | null; links: NavLink[] }[] = [
    {
        title: null,
        links: [{ href: "/admin", label: "ภาพรวม", exact: true }],
    },
    {
        title: "งานวิ่ง",
        links: [
            { href: "/admin/events", label: "กิจกรรม" },
            { href: "/admin/registrations", label: "ผู้สมัคร" },
            { href: "/admin/invite-codes", label: "สิทธิพิเศษ", hint: "โควตาสปอนเซอร์" },
            { href: "/admin/checkin", label: "CheckBIB", hint: "สแกนรับเสื้อหน้างาน" },
            { href: "/admin/submissions", label: "ผลวิ่ง VR", hint: "ผลสะสมระยะ" },
            { href: "/admin/achievements", label: "ความสำเร็จ" },
        ],
    },
    {
        title: "ร้านค้า",
        links: [
            { href: "/admin/products", label: "สินค้า", hint: "เสื้อ ของที่ระลึก สต็อก" },
            { href: "/admin/orders", label: "ออเดอร์" },
            { href: "/admin/shop", label: "ตั้งค่าร้าน", hint: "ค่าส่ง จุดรับของ" },
        ],
    },
    {
        title: "ทั้งระบบ",
        links: [{ href: "/admin/users", label: "ผู้ใช้งาน" }],
    },
]

export function AdminShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const [open, setOpen] = useState(false)

    const nav = (
        <nav className="px-4">
            {NAV_GROUPS.map((group, gi) => (
                <div key={group.title ?? "root"} className={cn(gi > 0 && "mt-5")}>
                    {group.title && (
                        <p className="eyebrow text-ink-mute px-3 mb-1">{group.title}</p>
                    )}
                    <ul className="space-y-0.5">
                        {group.links.map((l) => {
                            const active = l.exact ? pathname === l.href : pathname.startsWith(l.href)
                            return (
                                <li key={l.href}>
                                    <Link
                                        href={l.href}
                                        onClick={() => setOpen(false)}
                                        className={cn(
                                            "block px-3 py-2 rounded-2xl transition-colors",
                                            active ? "bg-ink text-white" : "text-ink-soft hover:bg-paper-2 hover:text-ink"
                                        )}
                                    >
                                        <span className="block text-sm font-semibold tracking-tight">{l.label}</span>
                                        {l.hint && (
                                            <span
                                                className={cn(
                                                    "block text-[11px] mt-0.5 leading-snug",
                                                    active ? "text-white/60" : "text-ink-mute"
                                                )}
                                            >
                                                {l.hint}
                                            </span>
                                        )}
                                    </Link>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            ))}

            <div className="mt-6 pt-4 border-t border-line space-y-0.5">
                <Link
                    href="/"
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2 rounded-2xl text-sm font-semibold tracking-tight text-ink-soft hover:bg-paper-2 hover:text-ink transition-colors"
                >
                    กลับหน้าเว็บ
                </Link>
                <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="w-full text-left px-3 py-2 rounded-2xl text-sm font-semibold tracking-tight text-ink-mute hover:text-danger hover:bg-paper-2 transition-colors"
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

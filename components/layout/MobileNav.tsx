'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { NAV_ITEMS, isActive } from "./nav-items"
import { CartCountBadge } from "./CartButton"
import { cn } from "@/lib/utils"

export function MobileNav({ cartCount = 0 }: { cartCount?: number }) {
    const pathname = usePathname()
    if (pathname.startsWith("/auth") || pathname.startsWith("/admin")) return null

    return (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-paper/95 backdrop-blur-xl border-t border-line pb-safe">
            {/* จำนวนคอลัมน์ยึดตาม NAV_ITEMS เพื่อไม่ให้ตกบรรทัดเวลาเพิ่มเมนูใหม่ */}
            <ul className="grid h-[62px]" style={{ gridTemplateColumns: `repeat(${NAV_ITEMS.length}, minmax(0, 1fr))` }}>
                {NAV_ITEMS.map((item) => {
                    const active = isActive(pathname, item.href)
                    const isShop = item.href === "/shop"
                    return (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                    "h-full flex flex-col items-center justify-center gap-1.5 transition-colors",
                                    active ? "text-ink" : "text-ink-mute"
                                )}
                            >
                                <span className="relative">
                                    <item.icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.5 : 1.8} />
                                    {isShop && cartCount > 0 && (
                                        <CartCountBadge count={cartCount} className="absolute -top-1.5 -right-2.5 block" />
                                    )}
                                </span>
                                <span className="text-[12px] font-semibold tracking-tight">{item.name}</span>
                            </Link>
                        </li>
                    )
                })}
            </ul>
        </nav>
    )
}

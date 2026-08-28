'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { NAV_ITEMS, isActive } from "./nav-items"
import { cn } from "@/lib/utils"

export function MobileNav() {
    const pathname = usePathname()
    if (pathname.startsWith("/auth") || pathname.startsWith("/admin")) return null

    return (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-paper/95 backdrop-blur-xl border-t border-line pb-safe">
            <ul className="grid grid-cols-3 h-[62px]">
                {NAV_ITEMS.map((item) => {
                    const active = isActive(pathname, item.href)
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
                                <item.icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.5 : 1.8} />
                                <span className="text-[10px] font-semibold tracking-tight">{item.name}</span>
                            </Link>
                        </li>
                    )
                })}
            </ul>
        </nav>
    )
}

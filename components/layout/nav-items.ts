import { Home, Trophy, User, type LucideIcon } from "lucide-react"

/**
 * ไอคอนใช้เฉพาะแถบนำทางหลักเท่านั้น
 * หน้าแรกคือรายการงานวิ่ง จึงไม่มีเมนู "กิจกรรม" แยกอีก
 */
export interface NavItem {
    name: string
    href: string
    icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
    { name: "งานวิ่ง", href: "/", icon: Home },
    { name: "อันดับ", href: "/leaderboard", icon: Trophy },
    { name: "โปรไฟล์", href: "/profile", icon: User },
]

export function isActive(pathname: string, href: string) {
    if (href === "/") return pathname === "/" || pathname.startsWith("/events")
    return pathname === href || pathname.startsWith(href + "/")
}

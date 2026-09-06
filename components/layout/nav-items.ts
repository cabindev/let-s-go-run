import { Home, ShoppingBag, Trophy, User, type LucideIcon } from "lucide-react"

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
    { name: "ร้านค้า", href: "/shop", icon: ShoppingBag },
    { name: "อันดับ", href: "/leaderboard", icon: Trophy },
    { name: "โปรไฟล์", href: "/profile", icon: User },
]

export function isActive(pathname: string, href: string) {
    if (href === "/") return pathname === "/" || pathname.startsWith("/events")
    // ตะกร้า/ยืนยันคำสั่งซื้อ/คำสั่งซื้อ ถือเป็นส่วนหนึ่งของร้านค้า
    if (href === "/shop") return ["/shop", "/cart", "/checkout", "/orders"].some((p) => pathname.startsWith(p))
    return pathname === href || pathname.startsWith(href + "/")
}

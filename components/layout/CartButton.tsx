import Link from "next/link"
import { ShoppingBag } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * ปุ่มตะกร้าพร้อมตัวเลขจำนวนชิ้น — อยู่บนแถบบนของทุกหน้า
 * จำนวนมาจาก server (layout) จึงตรงกับของจริงเสมอ ไม่ต้องพึ่ง state ฝั่ง client
 */
export function CartButton({ count, className }: { count: number; className?: string }) {
    return (
        <Link
            href="/cart"
            aria-label={count > 0 ? `ตะกร้าสินค้า ${count} ชิ้น` : "ตะกร้าสินค้า"}
            className={cn(
                "relative inline-flex items-center justify-center w-10 h-10 rounded-full text-ink-soft",
                "hover:text-ink hover:bg-paper-2 transition-colors",
                className
            )}
        >
            <ShoppingBag className="w-[22px] h-[22px]" strokeWidth={1.8} />
            {count > 0 && (
                <span
                    className={cn(
                        "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full",
                        "bg-danger text-white text-[11px] font-bold leading-[18px] text-center tnum"
                    )}
                >
                    {count > 99 ? "99+" : count}
                </span>
            )}
        </Link>
    )
}

/** ตัวเลขเล็กๆ ต่อท้ายเมนู "ร้านค้า" ในแถบนำทาง */
export function CartCountBadge({ count, className }: { count: number; className?: string }) {
    if (count <= 0) return null
    return (
        <span
            className={cn(
                "min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white",
                "text-[11px] font-bold leading-[18px] text-center tnum",
                className
            )}
        >
            {count > 99 ? "99+" : count}
        </span>
    )
}

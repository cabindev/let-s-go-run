import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

/** เพจจิเนชันแบบลิงก์ล้วน — ไม่ต้องใช้ client JS เพราะแค่เปลี่ยน query param */
export function Pagination({
    page,
    totalPages,
    basePath,
    params,
}: {
    page: number
    totalPages: number
    basePath: string
    params: Record<string, string | undefined>
}) {
    if (totalPages <= 1) return null

    const hrefFor = (p: number) => {
        const sp = new URLSearchParams()
        for (const [key, value] of Object.entries(params)) {
            if (value) sp.set(key, value)
        }
        if (p > 1) sp.set("page", String(p))
        const qs = sp.toString()
        return qs ? `${basePath}?${qs}` : basePath
    }

    // แสดงหน้าแรก/สุดท้ายเสมอ บวกหน้าใกล้ๆ หน้าปัจจุบัน ที่เหลือย่อด้วย "···"
    const keep = new Set<number>([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages))
    const pages = [...keep].sort((a, b) => a - b)

    return (
        <nav className="flex items-center justify-center gap-1.5 pt-2" aria-label="เปลี่ยนหน้า">
            <Link
                href={hrefFor(Math.max(1, page - 1))}
                className={cn(
                    "w-9 h-9 flex items-center justify-center rounded-full border border-line transition-colors shrink-0",
                    page === 1 ? "opacity-30 pointer-events-none" : "hover:border-ink-mute"
                )}
                aria-label="หน้าก่อนหน้า"
            >
                <ChevronLeft className="w-4 h-4" strokeWidth={2.2} />
            </Link>

            {pages.map((p, i) => (
                <span key={p} className="flex items-center gap-1.5">
                    {i > 0 && p - pages[i - 1] > 1 && <span className="text-ink-mute text-[13px] px-0.5">···</span>}
                    <Link
                        href={hrefFor(p)}
                        className={cn(
                            "min-w-9 h-9 px-2 flex items-center justify-center rounded-full text-[13px] font-semibold tnum transition-colors",
                            p === page ? "bg-ink text-white" : "text-ink-soft hover:bg-paper-2"
                        )}
                    >
                        {p}
                    </Link>
                </span>
            ))}

            <Link
                href={hrefFor(Math.min(totalPages, page + 1))}
                className={cn(
                    "w-9 h-9 flex items-center justify-center rounded-full border border-line transition-colors shrink-0",
                    page === totalPages ? "opacity-30 pointer-events-none" : "hover:border-ink-mute"
                )}
                aria-label="หน้าถัดไป"
            >
                <ChevronRight className="w-4 h-4" strokeWidth={2.2} />
            </Link>
        </nav>
    )
}

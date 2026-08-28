import Link from "next/link"
import { cn } from "@/lib/utils"

/** โลโก้ตัวอักษรล้วน แบบ Nike wordmark */
export function Wordmark({ className, sub }: { className?: string; sub?: string }) {
    return (
        <Link href="/" className={cn("inline-flex flex-col leading-none", className)}>
            <span className="display text-lg uppercase tracking-[-0.03em] text-ink">
                Run<span className="text-move">Club</span>
            </span>
            {sub && <span className="eyebrow mt-1">{sub}</span>}
        </Link>
    )
}

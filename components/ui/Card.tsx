import { cn } from "@/lib/utils"

/** การ์ดขาวบนพื้นเทาอ่อน — มีเส้นขอบบาง ๆ ให้ขอบเขตชัด */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("bg-paper border border-line rounded-3xl", className)} {...props} />
}

export function SectionTitle({
    title,
    action,
    className,
}: {
    title: string
    action?: React.ReactNode
    className?: string
}) {
    return (
        <div className={cn("flex items-baseline justify-between gap-4 mb-4", className)}>
            <h2 className="eyebrow">{title}</h2>
            {action}
        </div>
    )
}

export function MoreLink({ href, children = "ดูทั้งหมด" }: { href: string; children?: React.ReactNode }) {
    return (
        <a
            href={href}
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute hover:text-ink transition-colors"
        >
            {children}
        </a>
    )
}

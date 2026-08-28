import { cn, initials } from "@/lib/utils"

export function Avatar({
    src, name, email, size = 40, className,
}: {
    src?: string | null
    name?: string | null
    email?: string | null
    size?: number
    className?: string
}) {
    const cls = cn(
        "rounded-full object-cover shrink-0 bg-ink text-white font-bold flex items-center justify-center tracking-tight",
        className
    )
    if (src) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={src} alt={name || "avatar"} className={cn(cls, "bg-paper-3")} style={{ width: size, height: size }} />
    }
    return (
        <span className={cls} style={{ width: size, height: size, fontSize: size * 0.38 }}>
            {initials(name, email)}
        </span>
    )
}

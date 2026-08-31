import Link from "next/link"
import { cn } from "@/lib/utils"

type Variant = "primary" | "solid" | "outline" | "ghost" | "danger"
type Size = "sm" | "md" | "lg"

const VARIANTS: Record<Variant, string> = {
    /** ดำบนขาว — ปุ่มหลักแบบ Nike */
    primary: "bg-ink text-white hover:bg-ink-soft active:bg-ink-soft disabled:bg-paper-3 disabled:text-ink-mute",
    /** เหลืองแบรนด์ — พื้นเหลือง ตัวอักษรดำ (เหลืองคอนทราสต์ต่ำเกินจะใช้เป็นตัวอักษรบนขาวได้) */
    solid: "bg-move text-ink hover:bg-move/90 disabled:bg-move/40 disabled:text-ink/40",
    outline: "border border-line bg-paper text-ink hover:border-ink-mute hover:bg-paper-2 disabled:opacity-40",
    ghost: "text-ink-soft hover:text-ink hover:bg-paper-2 disabled:opacity-40",
    danger: "bg-danger text-white hover:bg-danger/90 disabled:opacity-40",
}

const SIZES: Record<Size, string> = {
    sm: "h-9 px-4 text-[13px]",
    md: "h-12 px-6 text-sm",
    lg: "h-14 px-8 text-[15px]",
}

const BASE =
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper-2 " +
    "disabled:cursor-not-allowed select-none"

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
    return cn(BASE, VARIANTS[variant], SIZES[size], className)
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant
    size?: Size
}

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
    return <button className={buttonClass(variant, size, className)} {...props} />
}

interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
    variant?: Variant
    size?: Size
}

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ButtonLinkProps) {
    return <Link className={buttonClass(variant, size, className)} {...props} />
}

/** ตัวหมุนรอโหลด — จุดสามจุด ไม่ใช้ไอคอน */
export function Spinner({ className }: { className?: string }) {
    return (
        <span className={cn("inline-flex gap-1", className)} role="status" aria-label="กำลังโหลด">
            {[0, 1, 2].map((i) => (
                <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-current animate-bounce"
                    style={{ animationDelay: `${i * 120}ms`, animationDuration: "0.9s" }}
                />
            ))}
        </span>
    )
}

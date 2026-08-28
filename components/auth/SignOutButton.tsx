'use client'

import { signOut } from "next-auth/react"

export default function SignOutButton({ className }: { className?: string }) {
    return (
        <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/' })}
            className={className ?? "text-[13px] font-semibold text-ink-mute hover:text-move transition-colors"}
        >
            ออกจากระบบ
        </button>
    )
}

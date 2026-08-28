'use client'

import { useState } from "react"

export function CopyButton({ value }: { value: string }) {
    const [copied, setCopied] = useState(false)

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 1800)
        } catch {
            /* คลิปบอร์ดไม่พร้อมใช้งาน */
        }
    }

    return (
        <button
            type="button"
            onClick={copy}
            className="eyebrow text-ink-soft hover:text-ink transition-colors"
        >
            {copied ? "คัดลอกแล้ว" : "คัดลอก"}
        </button>
    )
}

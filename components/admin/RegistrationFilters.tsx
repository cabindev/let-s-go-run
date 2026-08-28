'use client'

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useState, useEffect, useTransition } from "react"
import { Search } from "lucide-react"
import { Button, Spinner } from "@/components/ui/Button"
import { inputClass } from "@/components/ui/Field"

/** ค้นหาชื่อ/อีเมล/เบอร์/BIB และกรองตามงาน */
export function RegistrationFilters({ events }: { events: { id: string; title: string }[] }) {
    const router = useRouter()
    const pathname = usePathname()
    const params = useSearchParams()
    const [isPending, startTransition] = useTransition()

    const [q, setQ] = useState(params.get("q") ?? "")
    const [eventId, setEventId] = useState(params.get("event") ?? "")

    useEffect(() => {
        setQ(params.get("q") ?? "")
        setEventId(params.get("event") ?? "")
    }, [params])

    const submit = (e?: React.FormEvent) => {
        e?.preventDefault()
        const next = new URLSearchParams()
        const status = params.get("status")
        if (status) next.set("status", status)
        if (q.trim()) next.set("q", q.trim())
        if (eventId) next.set("event", eventId)
        startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }))
    }

    const clear = () => {
        setQ("")
        setEventId("")
        startTransition(() => router.push(pathname, { scroll: false }))
    }

    const hasFilter = !!(params.get("q") || params.get("event") || params.get("status"))

    return (
        <form onSubmit={submit} className="bg-paper border border-line rounded-2xl p-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
                <label htmlFor="q" className="eyebrow block mb-2">ค้นหา</label>
                <input
                    id="q"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="ชื่อ · อีเมล · เบอร์โทร · BIB"
                    className={`${inputClass} h-11`}
                />
            </div>

            <div>
                <label htmlFor="event" className="eyebrow block mb-2">งาน</label>
                <select id="event" value={eventId} onChange={(e) => setEventId(e.target.value)} className={`${inputClass} h-11`}>
                    <option value="">ทุกงาน</option>
                    {events.map((e) => (
                        <option key={e.id} value={e.id}>{e.title.slice(0, 60)}</option>
                    ))}
                </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" size="sm" disabled={isPending}>
                    {isPending ? <Spinner /> : <><Search className="w-4 h-4" strokeWidth={2.2} />ค้นหา</>}
                </Button>
                {hasFilter && (
                    <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={isPending}>
                        ล้าง
                    </Button>
                )}
            </div>
        </form>
    )
}

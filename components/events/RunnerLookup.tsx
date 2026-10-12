'use client'

import { useState, useTransition } from "react"
import { Button, Spinner } from "@/components/ui/Button"
import { Badge, Notice } from "@/components/ui/Badge"
import { lookupRunner, type RunnerLookupResult } from "@/app/actions/runner-lookup"

const PICKUP: Record<RunnerLookupResult["pickupStatus"], { label: string; tone: "outline" | "lime" | "sky" }> = {
    PENDING: { label: "ยังไม่รับ BIB", tone: "outline" },
    PICKED_UP: { label: "รับ BIB แล้ว", tone: "lime" },
    SHIPPED: { label: "ส่งไปรษณีย์แล้ว", tone: "sky" },
}

/** กล่องเช็ครายชื่อนักวิ่งบนหน้าแรก — พิมพ์เบอร์หรือเลขบัตรช่องเดียว ระบบดูจากจำนวนหลักเอง */
export function RunnerLookup() {
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<RunnerLookupResult[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()

    function submit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setResults(null)
        startTransition(async () => {
            const res = await lookupRunner(query)
            if (res.ok) setResults(res.data)
            else setError(res.error)
        })
    }

    return (
        <div className="space-y-4">
            <form onSubmit={submit} className="flex gap-3">
                <label htmlFor="runner-lookup" className="sr-only">เบอร์โทรหรือเลขบัตรประชาชน</label>
                <input
                    id="runner-lookup"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="เบอร์โทร หรือเลขบัตรประชาชน"
                    className="flex-1 min-w-0 h-12 px-4 rounded-2xl border border-line bg-paper text-[15px] focus:outline-none focus:border-ink"
                />
                <Button type="submit" disabled={pending || !query.trim()} className="h-12 shrink-0">
                    {pending ? <Spinner /> : "เช็ครายชื่อ"}
                </Button>
            </form>

            {error && <Notice tone="danger">{error}</Notice>}

            {results && (
                <div className="grid gap-3 sm:grid-cols-2">
                    {results.map((r, i) => (
                        <div key={i} className="rounded-2xl border border-line bg-paper p-4 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[12px] text-ink-mute">{r.eventTitle} · {r.eventDate}</p>
                                    <p className="font-semibold tracking-tight mt-0.5">{r.maskedName}</p>
                                </div>
                                <Badge tone={PICKUP[r.pickupStatus].tone}>{PICKUP[r.pickupStatus].label}</Badge>
                            </div>
                            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                                <span className="numeral text-2xl">{r.bib || "-"}</span>
                                <span className="text-[13px] text-ink-soft">{r.categoryName || "-"}</span>
                                <span className="text-[13px] text-ink-soft">เสื้อ {r.shirtSize || "-"}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <p className="text-[12px] text-ink-mute">
                วันรับของ ยื่น QR ในหน้างานที่สมัคร หรือบอกเบอร์โทรกับเจ้าหน้าที่ และพกบัตรประชาชนมาด้วย
            </p>
        </div>
    )
}

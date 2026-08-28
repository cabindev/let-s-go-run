'use client'

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useState, useEffect, useTransition } from "react"
import { Search } from "lucide-react"
import { Button, Spinner } from "@/components/ui/Button"
import { PROVINCES, DISTANCE_BANDS } from "@/lib/events"
import { inputClass } from "@/components/ui/Field"

/**
 * แผงค้นหา — ชื่องาน / ระยะทาง
 * ช่อง "จังหวัด" ซ่อนไว้ก่อน (ยังไม่ใช้) เปลี่ยน SHOW_PROVINCE เป็น true เพื่อเปิดคืน
 * ตัวกรองฝั่ง server ยังรองรับ ?province= อยู่ ลิงก์เดิมจึงยังใช้ได้
 */
const SHOW_PROVINCE = false

export function EventSearch() {
    const router = useRouter()
    const pathname = usePathname()
    const params = useSearchParams()
    const [isPending, startTransition] = useTransition()

    const [q, setQ] = useState(params.get("q") ?? "")
    const [province, setProvince] = useState(params.get("province") ?? "")
    const [band, setBand] = useState(params.get("distance") ?? "")

    useEffect(() => {
        setQ(params.get("q") ?? "")
        setProvince(params.get("province") ?? "")
        setBand(params.get("distance") ?? "")
    }, [params])

    const submit = (e?: React.FormEvent) => {
        e?.preventDefault()
        const next = new URLSearchParams()
        if (q.trim()) next.set("q", q.trim())
        if (province) next.set("province", province)
        if (band) next.set("distance", band)
        const filter = params.get("filter")
        if (filter) next.set("filter", filter)
        startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }))
    }

    const clear = () => {
        setQ("")
        setProvince("")
        setBand("")
        startTransition(() => router.push(pathname, { scroll: false }))
    }

    const hasFilter = !!(params.get("q") || params.get("province") || params.get("distance"))

    return (
        <form
            onSubmit={submit}
            className={`bg-paper border border-line rounded-3xl p-5 grid gap-5 sm:gap-4 sm:items-end ${SHOW_PROVINCE ? "sm:grid-cols-[1fr_1fr_1fr_auto]" : "sm:grid-cols-[1fr_1fr_auto]"
                }`}
        >
            <div>
                <label htmlFor="q" className="eyebrow block mb-2">ชื่องาน</label>
                <input
                    id="q"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="ค้นหาด้วยชื่องาน"
                    className={`${inputClass} h-11`}
                />
            </div>

            {SHOW_PROVINCE && (
                <div>
                    <label htmlFor="province" className="eyebrow block mb-2">จังหวัด</label>
                    <select
                        id="province"
                        value={province}
                        onChange={(e) => setProvince(e.target.value)}
                        className={`${inputClass} h-11`}
                    >
                        <option value="">ทุกจังหวัด</option>
                        {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
            )}

            <div>
                <label htmlFor="distance" className="eyebrow block mb-2">ระยะทาง</label>
                <select
                    id="distance"
                    value={band}
                    onChange={(e) => setBand(e.target.value)}
                    className={`${inputClass} h-11`}
                >
                    <option value="">ทุกระยะ</option>
                    {DISTANCE_BANDS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
                </select>
            </div>

            {/* ปุ่มอยู่แถวเดียวกับช่องกรอกบนจอกว้าง */}
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

'use client'

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useState, useEffect, useTransition } from "react"
import { Search } from "lucide-react"
import { Button, Spinner } from "@/components/ui/Button"
import { PROVINCES, DISTANCE_BANDS } from "@/lib/events"
import { cn } from "@/lib/utils"

/**
 * แผงค้นหา — ชื่องาน / ระยะทาง
 * ช่อง "จังหวัด" ซ่อนไว้ก่อน (ยังไม่ใช้) เปลี่ยน SHOW_PROVINCE เป็น true เพื่อเปิดคืน
 * ตัวกรองฝั่ง server ยังรองรับ ?province= อยู่ ลิงก์เดิมจึงยังใช้ได้
 */
const SHOW_PROVINCE = false

/**
 * `header` = เวอร์ชันที่ฝังอยู่ในแถบบน (จอ lg ขึ้นไป) / `page` = การ์ดเต็มบนหน้าแรก (จอเล็ก)
 *
 * สองเวอร์ชันนี้ถูก render พร้อมกันแล้วซ่อนทีละอันด้วย CSS จึงต้องแยก id ของช่องกรอก
 * ไม่งั้นจะมี id ซ้ำกันสองชุดในหน้าเดียว แล้ว <label htmlFor> จะชี้ผิดตัว
 */
export function EventSearch({ variant = "page" }: { variant?: "page" | "header" }) {
    const header = variant === "header"
    const fieldId = (name: string) => `${variant}-${name}`
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
        /*
         * แถบค้นหาแถวเดียว — ป้ายกำกับเป็น sr-only แล้วใช้ placeholder แทน
         *
         * ของเดิมเป็นการ์ดที่มีป้ายกำกับลอยเหนือทุกช่อง สูงเกือบ 110px กินพื้นที่ครึ่งจอแรก
         * จนการ์ดงานวิ่งใบแรกตกไปอยู่ใต้เส้นพับ ทั้งที่งานวิ่งคือของหลักที่คนเข้ามาดู
         */
        <form
            onSubmit={submit}
            role="search"
            className={cn(
                "flex items-center",
                header
                    ? "w-full h-11 gap-2 pl-4 pr-1.5 bg-paper-2 border border-line rounded-full focus-within:border-ink-mute transition-colors"
                    : "raise flex-wrap gap-2 p-2 pl-4 sm:pl-5 bg-paper border border-line rounded-3xl sm:rounded-full"
            )}
        >
            <div className={cn("flex items-center gap-2.5 flex-1", header ? "min-w-0" : "min-w-[11rem]")}>
                <Search className="w-[18px] h-[18px] shrink-0 text-ink-mute" strokeWidth={2} />
                <label htmlFor={fieldId("q")} className="sr-only">ชื่องาน</label>
                <input
                    id={fieldId("q")}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={header ? "ค้นหางานวิ่ง" : "ค้นหางานวิ่งด้วยชื่องาน"}
                    className={cn(
                        "flex-1 min-w-0 bg-transparent tracking-tight text-ink placeholder:text-ink-mute focus:outline-none",
                        header ? "h-9 text-sm" : "h-11 text-[15px]"
                    )}
                />
            </div>

            {SHOW_PROVINCE && (
                <>
                    <span aria-hidden className="hidden sm:block w-px h-6 bg-line shrink-0" />
                    <label htmlFor={fieldId("province")} className="sr-only">จังหวัด</label>
                    <select
                        id={fieldId("province")}
                        value={province}
                        onChange={(e) => setProvince(e.target.value)}
                        className="h-11 shrink-0 bg-transparent text-[15px] tracking-tight text-ink-soft focus:outline-none cursor-pointer"
                    >
                        <option value="">ทุกจังหวัด</option>
                        {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                </>
            )}

            {/* ในแถบบนที่แคบกว่า ช่องระยะทางโผล่เฉพาะจอกว้างพอ — จอแคบกว่านั้นใช้การ์ดบนหน้าแรกแทน */}
            <span aria-hidden className={cn("w-px h-6 bg-line shrink-0", header ? "hidden xl:block" : "hidden sm:block")} />
            <label htmlFor={fieldId("distance")} className="sr-only">ระยะทาง</label>
            <select
                id={fieldId("distance")}
                value={band}
                onChange={(e) => setBand(e.target.value)}
                className={cn(
                    "shrink-0 bg-transparent tracking-tight text-ink-soft focus:outline-none cursor-pointer",
                    header ? "hidden xl:block h-9 text-sm" : "h-11 text-[15px]"
                )}
            >
                <option value="">ทุกระยะ</option>
                {DISTANCE_BANDS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
            </select>

            <div className={cn("flex items-center gap-2 shrink-0", !header && "ml-auto sm:ml-0")}>
                {hasFilter && (
                    <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={isPending}>
                        ล้าง
                    </Button>
                )}
                {header ? (
                    <Button type="submit" size="sm" aria-label="ค้นหา" disabled={isPending} className="w-9 px-0">
                        {isPending ? <Spinner /> : <Search className="w-4 h-4" strokeWidth={2.4} />}
                    </Button>
                ) : (
                    <Button type="submit" size="sm" disabled={isPending}>
                        {isPending ? <Spinner /> : <><Search className="w-4 h-4" strokeWidth={2.2} />ค้นหา</>}
                    </Button>
                )}
            </div>
        </form>
    )
}

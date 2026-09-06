'use client'

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useState, useTransition } from "react"
import { Search } from "lucide-react"
import { Button, Spinner } from "@/components/ui/Button"
import { inputClass } from "@/components/ui/Field"
import { PRODUCT_TYPE_LABEL } from "@/lib/shop"

/** ค้นหาเลขที่ออเดอร์/ชื่อผู้รับ/เบอร์/เลขพัสดุ และกรองตามประเภทสินค้า */
export function OrderFilters() {
    const router = useRouter()
    const pathname = usePathname()
    const params = useSearchParams()
    const [isPending, startTransition] = useTransition()

    const qParam = params.get("q") ?? ""
    const typeParam = params.get("type") ?? ""

    const [q, setQ] = useState(qParam)
    const [type, setType] = useState(typeParam)

    // ซิงก์ช่องกรอกกลับตาม URL เมื่อผู้ใช้กด "ล้าง" หรือกดปุ่มย้อนกลับของเบราว์เซอร์
    // ปรับ state ตอนเรนเดอร์แทน useEffect ตามแนวทางของ React — เลี่ยงเรนเดอร์ซ้อนรอบ
    const [seen, setSeen] = useState({ q: qParam, type: typeParam })
    if (seen.q !== qParam || seen.type !== typeParam) {
        setSeen({ q: qParam, type: typeParam })
        setQ(qParam)
        setType(typeParam)
    }

    const submit = (e?: React.FormEvent) => {
        e?.preventDefault()
        const next = new URLSearchParams()
        const status = params.get("status")
        if (status) next.set("status", status)
        if (q.trim()) next.set("q", q.trim())
        if (type) next.set("type", type)
        startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }))
    }

    const clear = () => {
        setQ("")
        setType("")
        startTransition(() => router.push(pathname, { scroll: false }))
    }

    const hasFilter = !!(params.get("q") || params.get("type") || params.get("status"))

    return (
        <form
            onSubmit={submit}
            className="bg-paper border border-line rounded-2xl p-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
            <div>
                <label htmlFor="order-q" className="eyebrow block mb-2">ค้นหา</label>
                <input
                    id="order-q"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="เลขที่ออเดอร์ · ชื่อผู้รับ · เบอร์ · เลขพัสดุ"
                    className={`${inputClass} h-11`}
                />
            </div>

            <div>
                <label htmlFor="order-type" className="eyebrow block mb-2">ประเภทสินค้า</label>
                <select
                    id="order-type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className={`${inputClass} h-11`}
                >
                    <option value="">ทุกประเภท</option>
                    <option value="STOCK">{PRODUCT_TYPE_LABEL.STOCK}</option>
                    <option value="PREORDER">{PRODUCT_TYPE_LABEL.PREORDER}</option>
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

'use client'

import { useState } from "react"
import { inputClass } from "@/components/ui/Field"
import { SHIRT_SIZES, SHIRT_SIZE_CHART } from "@/lib/events"

export interface VariantRow {
    key: number
    name: string
    price: string
    stock: string
}

const blank = (key: number): VariantRow => ({ key, name: "", price: "", stock: "" })

/**
 * แถวตัวเลือกสินค้า (ไซส์/สี) ตอนสร้างสินค้าใหม่
 * ส่งค่าเป็น array ชื่อเดียวกันทุกแถว (variant.name / variant.price / variant.stock)
 * แล้วให้ฝั่ง server จับคู่ตามลำดับ — รูปแบบเดียวกับ CategoryRows
 */
export function VariantRows({ isPreorder }: { isPreorder: boolean }) {
    const [rows, setRows] = useState<VariantRow[]>([blank(0)])

    const update = (key: number, field: keyof VariantRow, value: string) =>
        setRows((r) => r.map((x) => (x.key === key ? { ...x, [field]: value } : x)))

    const add = () => setRows((r) => [...r, blank(Math.max(...r.map((x) => x.key)) + 1)])
    const remove = (key: number) => setRows((r) => (r.length === 1 ? r : r.filter((x) => x.key !== key)))

    /** เติมไซส์เสื้อมาตรฐานให้ครบรวดเดียว — งานส่วนใหญ่ขายเสื้อ จะได้ไม่ต้องพิมพ์ทีละแถว */
    const fillShirtSizes = () =>
        setRows(
            SHIRT_SIZES.map((s, i) => ({
                key: i,
                name: `${s} (รอบอก ${SHIRT_SIZE_CHART[s]} นิ้ว)`,
                price: "",
                stock: "",
            }))
        )

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="eyebrow">ตัวเลือกสินค้า</p>
                    <p className="text-[12px] text-ink-mute mt-1">
                        เช่น ไซส์ สี หรือแพ็ก — ถ้าสินค้าไม่มีตัวเลือกให้ใส่แถวเดียวชื่อ &ldquo;มาตรฐาน&rdquo;
                    </p>
                </div>
                <button
                    type="button"
                    onClick={fillShirtSizes}
                    className="eyebrow text-ink-mute hover:text-ink transition-colors shrink-0"
                >
                    เติมไซส์เสื้อมาตรฐาน
                </button>
            </div>

            <ul className="space-y-3">
                {rows.map((row, i) => (
                    <li key={row.key} className="border border-line rounded-2xl p-4 bg-paper">
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <span className="eyebrow tnum">ตัวเลือกที่ {i + 1}</span>
                            {rows.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => remove(row.key)}
                                    className="eyebrow text-ink-mute hover:text-danger transition-colors"
                                >
                                    ลบ
                                </button>
                            )}
                        </div>

                        <label className="block">
                            <span className="eyebrow block mb-1.5">
                                ชื่อตัวเลือก <span className="text-danger">*</span>
                            </span>
                            <input
                                name="variant.name"
                                required
                                maxLength={80}
                                value={row.name}
                                onChange={(e) => update(row.key, "name", e.target.value)}
                                placeholder="M (รอบอก 38 นิ้ว)"
                                className={`${inputClass} h-11`}
                            />
                        </label>

                        <div className="grid sm:grid-cols-2 gap-4 mt-4">
                            <label className="block">
                                <span className="eyebrow block mb-1.5">ราคาเฉพาะตัวเลือกนี้</span>
                                <input
                                    name="variant.price"
                                    type="number"
                                    step="1"
                                    min="0"
                                    value={row.price}
                                    onChange={(e) => update(row.key, "price", e.target.value)}
                                    placeholder="เว้นว่าง = ใช้ราคาสินค้า"
                                    className={`${inputClass} h-11`}
                                />
                            </label>

                            <label className="block">
                                <span className="eyebrow block mb-1.5">จำนวนในสต็อก</span>
                                <input
                                    name="variant.stock"
                                    type="number"
                                    step="1"
                                    min="0"
                                    value={row.stock}
                                    onChange={(e) => update(row.key, "stock", e.target.value)}
                                    placeholder={isPreorder ? "เว้นว่าง = ไม่จำกัด" : "0 = หมด"}
                                    className={`${inputClass} h-11`}
                                />
                                <span className="text-[11px] text-ink-mute mt-1 block">
                                    {isPreorder
                                        ? "พรีออเดอร์มักเว้นว่าง (ผลิตตามยอดสั่ง) — ใส่ตัวเลขได้ถ้าจำกัดโควตา"
                                        : "เว้นว่าง = ไม่จำกัดจำนวน"}
                                </span>
                            </label>
                        </div>
                    </li>
                ))}
            </ul>

            <button
                type="button"
                onClick={add}
                className="w-full h-11 rounded-2xl border border-dashed border-line hover:border-ink-mute text-[13px] font-semibold text-ink-soft transition-colors"
            >
                + เพิ่มตัวเลือก
            </button>
        </section>
    )
}

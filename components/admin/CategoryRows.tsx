'use client'

import { useState } from "react"
import { inputClass } from "@/components/ui/Field"

export interface CategoryRow {
    key: number
    name: string
    distance: string
    price: string
    maxSlots: string
}

const blank = (key: number): CategoryRow => ({ key, name: "", distance: "", price: "", maxSlots: "" })

/**
 * แถวระยะและค่าสมัคร — งานหนึ่งมีได้หลายระยะ ราคาต่างกัน
 * ส่งค่าเป็น array ชื่อเดียวกันทุกแถว (cat.name / cat.distance / ...) แล้วให้ฝั่ง server จับคู่ตามลำดับ
 */
export function CategoryRows({ isVirtual }: { isVirtual: boolean }) {
    const [rows, setRows] = useState<CategoryRow[]>([blank(0)])

    const update = (key: number, field: keyof CategoryRow, value: string) =>
        setRows((r) => r.map((x) => (x.key === key ? { ...x, [field]: value } : x)))

    const add = () => setRows((r) => [...r, blank(Math.max(...r.map((x) => x.key)) + 1)])
    const remove = (key: number) => setRows((r) => (r.length === 1 ? r : r.filter((x) => x.key !== key)))

    return (
        <section className="space-y-4">
            <div>
                <p className="eyebrow">{isVirtual ? "ระยะเป้าหมายและค่าสมัคร" : "ระยะและค่าสมัคร"}</p>
                <p className="text-[12px] text-ink-mute mt-1">
                    {isVirtual
                        ? "เพิ่มได้หลายแพ็กเกจ เช่น 50 กม. ฿390 / 100 กม. ฿490"
                        : "เพิ่มได้หลายระยะ เช่น 10 กม. ฿400 / 21 กม. ฿900 — ผู้สมัครจะเลือกตอนสมัคร"}
                </p>
            </div>

            <ul className="space-y-3">
                {rows.map((row, i) => (
                    <li key={row.key} className="border border-line rounded-2xl p-4 bg-paper">
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <span className="eyebrow tnum">ระยะที่ {i + 1}</span>
                            {rows.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => remove(row.key)}
                                    className="eyebrow text-ink-mute hover:text-move transition-colors"
                                >
                                    ลบ
                                </button>
                            )}
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <label className="block">
                                <span className="eyebrow block mb-1.5">
                                    ชื่อระยะ <span className="text-move">*</span>
                                </span>
                                <input
                                    name="cat.name"
                                    required
                                    maxLength={100}
                                    value={row.name}
                                    onChange={(e) => update(row.key, "name", e.target.value)}
                                    placeholder={isVirtual ? "Solo 50 กม." : "Mini Marathon 10 กม."}
                                    className={`${inputClass} h-11`}
                                />
                            </label>

                            <label className="block">
                                <span className="eyebrow block mb-1.5">
                                    {isVirtual ? "ระยะเป้าหมาย (กม.)" : "ระยะทาง (กม.)"} <span className="text-move">*</span>
                                </span>
                                <input
                                    name="cat.distance"
                                    type="number"
                                    step="any"
                                    min="0"
                                    required
                                    value={row.distance}
                                    onChange={(e) => update(row.key, "distance", e.target.value)}
                                    placeholder="42.195"
                                    className={`${inputClass} h-11`}
                                />
                            </label>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4 mt-4">
                            <label className="block">
                                <span className="eyebrow block mb-1.5">
                                    ค่าสมัคร (บาท) <span className="text-move">*</span>
                                </span>
                                <input
                                    name="cat.price"
                                    type="number"
                                    step="1"
                                    min="0"
                                    required
                                    value={row.price}
                                    onChange={(e) => update(row.key, "price", e.target.value)}
                                    placeholder="0 = ฟรี"
                                    className={`${inputClass} h-11`}
                                />
                            </label>

                            <label className="block">
                                <span className="eyebrow block mb-1.5">จำนวนที่รับ</span>
                                <input
                                    name="cat.maxSlots"
                                    type="number"
                                    step="1"
                                    min="1"
                                    value={row.maxSlots}
                                    onChange={(e) => update(row.key, "maxSlots", e.target.value)}
                                    placeholder="เว้นว่าง = ไม่จำกัด"
                                    className={`${inputClass} h-11`}
                                />
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
                + เพิ่มระยะ
            </button>
        </section>
    )
}

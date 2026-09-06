'use client'

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { ShopSetting } from "@prisma/client"
import { updateShopSetting } from "@/app/actions/shop-admin"
import { Button, Spinner } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"
import { Field, TextArea } from "@/components/ui/Field"
import { shippingFee } from "@/lib/shop"
import { formatBaht } from "@/lib/utils"

export function ShopSettingForm({ setting }: { setting: ShopSetting }) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)

    // แสดงตัวอย่างค่าส่งสดๆ ขณะพิมพ์ เพื่อให้เห็นผลก่อนบันทึกจริง
    const [base, setBase] = useState(String(setting.shippingBaseFee))
    const [extra, setExtra] = useState(String(setting.shippingExtraPerItem))

    const preview = (qty: number) =>
        shippingFee(qty, {
            shippingBaseFee: Number(base) || 0,
            shippingExtraPerItem: Number(extra) || 0,
        })

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        setSaved(false)
        const formData = new FormData(e.currentTarget)
        startTransition(async () => {
            const res = await updateShopSetting(formData)
            if (!res.ok) {
                setError(res.error)
                return
            }
            setSaved(true)
            router.refresh()
        })
    }

    return (
        <form onSubmit={onSubmit} className="space-y-12">
            <section className="space-y-7">
                <div>
                    <p className="eyebrow">ค่าจัดส่งไปรษณีย์</p>
                    <p className="text-[12px] text-ink-mute mt-1">
                        คิดจากจำนวนชิ้นรวมของออเดอร์ — ชิ้นแรกคิดเต็ม ชิ้นถัดไปบวกเพิ่มชิ้นละตามที่ตั้งไว้
                    </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-7">
                    <Field
                        label="ค่าส่งชิ้นแรก (บาท)" name="shippingBaseFee" type="number" step="1" min="0" required
                        value={base}
                        onChange={(e) => setBase(e.target.value)}
                    />
                    <Field
                        label="ชิ้นถัดไป บวกชิ้นละ (บาท)" name="shippingExtraPerItem" type="number" step="1" min="0" required
                        value={extra}
                        onChange={(e) => setExtra(e.target.value)}
                    />
                </div>

                <div className="rounded-2xl bg-paper border border-line p-5">
                    <p className="eyebrow mb-3">ตัวอย่างค่าส่ง</p>
                    <ul className="space-y-1.5 text-sm tnum">
                        {[1, 2, 3, 5, 10].map((n) => (
                            <li key={n} className="flex justify-between">
                                <span className="text-ink-mute">{n} ชิ้น</span>
                                <span className="numeral">{formatBaht(preview(n))}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            <section className="space-y-7">
                <p className="eyebrow">ข้อความหน้าร้าน</p>

                <TextArea
                    label="จุดรับของ" name="pickupLocation" rows={3}
                    defaultValue={setting.pickupLocation ?? ""}
                    placeholder="ที่อยู่/เวลาที่ให้ลูกค้ามารับของด้วยตนเอง"
                    helper="แสดงตอนลูกค้าเลือกวิธีรับของแบบมารับเอง"
                />

                <TextArea
                    label="ประกาศหน้าร้าน" name="announcement" rows={3}
                    defaultValue={setting.announcement ?? ""}
                    placeholder="เว้นว่าง = ไม่แสดงประกาศ"
                    helper="แสดงเป็นแถบข้อความด้านบนของหน้าร้าน"
                />
            </section>

            {error && <Notice tone="danger">{error}</Notice>}
            {saved && <Notice tone="lime">บันทึกการตั้งค่าแล้ว</Notice>}

            <Button type="submit" disabled={pending}>
                {pending ? <Spinner /> : "บันทึกการตั้งค่า"}
            </Button>
        </form>
    )
}

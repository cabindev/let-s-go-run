'use client'

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { Product, ProductStatus, ProductType } from "@prisma/client"
import { createProduct, updateProduct } from "@/app/actions/shop-admin"
import { Button, Spinner, buttonClass } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"
import { Field, TextArea, Select } from "@/components/ui/Field"
import { VariantRows } from "./VariantRows"
import { ProductImageGroupInput } from "./ProductImageGroupInput"
import { PRODUCT_IMAGE_GROUPS, REQUIRED_PRODUCT_IMAGE_GROUPS } from "@/lib/product-image-groups"
import type { ProductImageCategory } from "@prisma/client"
import { formatDateTimeInput } from "@/lib/utils"

export interface EventOption {
    id: string
    title: string
}

export function ProductForm({ product, events }: { product?: Product; events: EventOption[] }) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    // นับรูปที่เลือกไว้ต่อหมวด เพื่อเตือนล่วงหน้าว่ารูปบังคับยังไม่ครบ
    const [picked, setPicked] = useState<Partial<Record<ProductImageCategory, number>>>({})
    const missingRequired = REQUIRED_PRODUCT_IMAGE_GROUPS.filter((g) => !picked[g.key])

    // ประเภทสินค้าเปลี่ยนความหมายของฟิลด์พรีออเดอร์ จึงต้องรู้ค่าปัจจุบันตอนเรนเดอร์
    const [type, setType] = useState<ProductType>(product?.type ?? "STOCK")
    const isPreorder = type === "PREORDER"

    // สถานะมีผลกับกฎรูปบังคับ จึงต้องรู้ค่าปัจจุบันเพื่อเตือนตั้งแต่ก่อนกดบันทึก
    const [status, setStatus] = useState<ProductStatus>(product?.status ?? "DRAFT")

    const isEdit = !!product

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        const formData = new FormData(e.currentTarget)
        startTransition(async () => {
            const res = isEdit ? await updateProduct(product.id, formData) : await createProduct(formData)
            if (!res.ok) {
                setError(res.error)
                return
            }
            router.push(isEdit ? `/admin/products/${product.id}/edit` : "/admin/products")
            router.refresh()
        })
    }

    return (
        <form onSubmit={onSubmit} className="space-y-12">
            <section>
                <p className="eyebrow mb-3">ประเภทสินค้า</p>
                <input type="hidden" name="type" value={type} />

                <div className="grid sm:grid-cols-2 gap-3">
                    <TypeCard
                        active={!isPreorder}
                        onClick={() => setType("STOCK")}
                        title="สินค้าพร้อมส่ง"
                        desc="มีของอยู่แล้ว ตัดสต็อกทันทีที่สั่ง จัดส่งได้เลย"
                    />
                    <TypeCard
                        active={isPreorder}
                        onClick={() => setType("PREORDER")}
                        title="พรีออเดอร์"
                        desc="ผลิตหลังปิดรอบสั่ง ผู้ซื้อรอรับตามกำหนดที่แจ้งไว้"
                    />
                </div>

                <Notice tone="neutral" className="mt-3">
                    สินค้าคนละประเภทจะถูกแยกเป็นคนละออเดอร์ตอนลูกค้ากดสั่ง เพราะรอบจัดส่งต่างกัน
                </Notice>
            </section>

            <section className="space-y-7">
                <p className="eyebrow">ข้อมูลสินค้า</p>

                <Field
                    label="ชื่อสินค้า" name="name" required maxLength={150}
                    defaultValue={product?.name}
                    placeholder="เสื้อวิ่ง RUNLUDTONG 8"
                />

                <TextArea
                    label="รายละเอียด" name="description" rows={5} required
                    defaultValue={product?.description}
                    placeholder="เนื้อผ้า ขนาด สิ่งที่ได้รับ เงื่อนไขการเปลี่ยน/คืน"
                />

                <div className="grid sm:grid-cols-2 gap-7">
                    <Field
                        label="ราคา (บาท)" name="price" type="number" step="1" min="0" required
                        defaultValue={product?.price ?? ""}
                        helper="ตั้งราคาเฉพาะบางตัวเลือกทับได้ในหัวข้อตัวเลือกสินค้า"
                    />
                    <Field
                        label="สั่งได้สูงสุดต่อออเดอร์" name="maxPerOrder" type="number" step="1" min="1" max="99"
                        defaultValue={product?.maxPerOrder ?? 10}
                        helper="กันคนกวาดของทั้งล็อตในครั้งเดียว"
                    />
                </div>

                <div className="grid sm:grid-cols-2 gap-7">
                    <Select
                        label="สถานะ"
                        name="status"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as ProductStatus)}
                    >
                        <option value="DRAFT">ร่าง (ยังไม่แสดงหน้าร้าน)</option>
                        <option value="ACTIVE">เปิดขาย</option>
                        <option value="HIDDEN">ซ่อน (หยุดขายชั่วคราว)</option>
                    </Select>
                    <Select label="ผูกกับงานวิ่ง" name="eventId" defaultValue={product?.eventId ?? ""}>
                        <option value="">ไม่ผูก (สินค้าทั่วไป)</option>
                        {events.map((e) => (
                            <option key={e.id} value={e.id}>{e.title}</option>
                        ))}
                    </Select>
                </div>

                <Field
                    label="ลิงก์สินค้า (slug)" name="slug" maxLength={150}
                    defaultValue={product?.slug ?? ""}
                    placeholder="เว้นว่าง = สร้างจากชื่อสินค้าอัตโนมัติ"
                    helper={product ? `ตอนนี้: /shop/${product.slug}` : "ใช้เป็น URL หน้าสินค้า เช่น /shop/เสื้อวิ่ง-runludtong-8"}
                />
            </section>

            {isPreorder && (
                <section className="space-y-7">
                    <p className="eyebrow">เงื่อนไขพรีออเดอร์</p>
                    <div className="grid sm:grid-cols-2 gap-7">
                        <Field
                            label="ปิดรับพรีออเดอร์" name="preorderCloseAt" type="datetime-local"
                            defaultValue={product?.preorderCloseAt ? formatDateTimeInput(product.preorderCloseAt) : ""}
                            helper="เว้นว่าง = ไม่กำหนด (ปิดเองด้วยการเปลี่ยนสถานะ)"
                        />
                        <Field
                            label="กำหนดส่งโดยประมาณ" name="estimatedShipAt" type="datetime-local"
                            defaultValue={product?.estimatedShipAt ? formatDateTimeInput(product.estimatedShipAt) : ""}
                            helper="แสดงให้ผู้ซื้อเห็นก่อนตัดสินใจ"
                        />
                    </div>
                    <TextArea
                        label="หมายเหตุพรีออเดอร์" name="preorderNote" rows={3}
                        defaultValue={product?.preorderNote ?? ""}
                        placeholder="รอบผลิต เงื่อนไขการยกเลิก ระยะเวลารอโดยประมาณ"
                    />
                </section>
            )}

            <section className="space-y-3">
                <p className="eyebrow">วิธีรับของที่อนุญาต</p>
                <p className="text-[12px] text-ink-mute">
                    ถ้าในตะกร้ามีสินค้าที่ไม่รองรับวิธีใด ลูกค้าจะเลือกวิธีนั้นไม่ได้ทั้งตะกร้า
                </p>
                <label className="flex items-center gap-3 text-sm">
                    <input type="checkbox" name="allowPickup" defaultChecked={product?.allowPickup ?? true} />
                    รับด้วยตนเอง
                </label>
                <label className="flex items-center gap-3 text-sm">
                    <input type="checkbox" name="allowShipping" defaultChecked={product?.allowShipping ?? true} />
                    ส่งไปรษณีย์ (คิดค่าส่งตามที่ตั้งไว้ในหน้าตั้งค่าร้าน)
                </label>
            </section>

            {/* ตอนสร้าง: ใส่ตัวเลือกได้เลย / ตอนแก้ไข: จัดการที่ตาราง "ตัวเลือกสินค้า" ด้านบนของหน้า */}
            {isEdit ? (
                <section className="space-y-5">
                    <p className="eyebrow">ตัวเลือกสินค้า</p>
                    <Notice tone="neutral">
                        แก้ไขได้ที่หัวข้อ &ldquo;ตัวเลือกและสต็อก&rdquo; ด้านบนของหน้านี้
                    </Notice>
                </section>
            ) : (
                <VariantRows isPreorder={isPreorder} />
            )}

            {!isEdit && (
                <section>
                    <p className="eyebrow mb-1">รูปสินค้า</p>
                    <p className="text-[12px] text-ink-mute mb-4">
                        บังคับแค่ <strong className="text-ink">ด้านหน้า</strong> กับ{" "}
                        <strong className="text-ink">ด้านหลัง</strong> ที่เหลือเพิ่มได้ตามต้องการ —
                        รูปด้านหน้าจะถูกใช้เป็นรูปปกบนหน้ารายการสินค้า · JPG, PNG, WEBP ไม่เกิน 5MB ต่อไฟล์
                    </p>

                    <div className="space-y-3">
                        {PRODUCT_IMAGE_GROUPS.map((g) => (
                            <ProductImageGroupInput
                                key={g.key}
                                group={g}
                                onChange={(count) => setPicked((p) => ({ ...p, [g.key]: count }))}
                            />
                        ))}
                    </div>

                    {status === "ACTIVE" && missingRequired.length > 0 && (
                        <Notice tone="danger" className="mt-4">
                            ยังไม่ได้เลือกรูป{missingRequired.map((g) => g.label).join("และ")} —
                            สินค้าที่เปิดขายต้องมีครบทั้งสองรูป หรือเลือกสถานะ &ldquo;ร่าง&rdquo; ไว้ก่อนแล้วมาเพิ่มทีหลัง
                        </Notice>
                    )}
                </section>
            )}

            {error && <Notice tone="danger">{error}</Notice>}

            <div className="flex gap-3">
                <Link href="/admin/products" className={buttonClass("outline", "md", "flex-1 sm:flex-none")}>
                    ยกเลิก
                </Link>
                <Button type="submit" className="flex-1 sm:flex-none" disabled={pending}>
                    {pending ? <Spinner /> : isEdit ? "บันทึกการแก้ไข" : "สร้างสินค้า"}
                </Button>
            </div>
        </form>
    )
}

function TypeCard({
    active,
    onClick,
    title,
    desc,
}: {
    active: boolean
    onClick: () => void
    title: string
    desc: string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`text-left p-4 rounded-2xl border transition-colors ${active ? "border-ink bg-paper ring-1 ring-ink" : "border-line bg-paper hover:border-ink-mute"
                }`}
        >
            <p className="text-sm font-semibold tracking-tight">{title}</p>
            <p className="text-[12px] text-ink-mute mt-1 leading-relaxed">{desc}</p>
        </button>
    )
}

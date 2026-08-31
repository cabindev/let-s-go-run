'use client'

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { Event, EventType } from "@prisma/client"
import { createEvent, updateEvent } from "@/app/actions/admin"
import { Button, Spinner, buttonClass } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"
import { Field, TextArea, Select } from "@/components/ui/Field"
import { PROVINCES } from "@/lib/events"
import { IMAGE_GROUPS } from "@/lib/image-groups"
import { ImageGroupInput } from "./ImageGroupInput"
import { CategoryRows } from "./CategoryRows"
import { formatDateInput, formatDateTimeInput } from "@/lib/utils"

export function EventForm({ event, defaultType }: { event?: Event; defaultType?: EventType }) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [preview, setPreview] = useState<string | null>(event?.image ?? null)

    // ประเภทงานเปลี่ยนความหมายของอีกหลายฟิลด์ จึงต้องรู้ค่าปัจจุบันตั้งแต่ตอนเรนเดอร์
    const [type, setType] = useState<EventType>(event?.type ?? defaultType ?? "ONSITE")
    const isVirtual = type === "VIRTUAL"

    const isEdit = !!event

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        const formData = new FormData(e.currentTarget)
        startTransition(async () => {
            const res = isEdit ? await updateEvent(event.id, formData) : await createEvent(formData)
            if (!res.ok) {
                setError(res.error)
                return
            }
            router.push("/admin/events")
            router.refresh()
        })
    }

    return (
        <form onSubmit={onSubmit} className="space-y-12">
            {/* เลือกประเภทก่อน เพราะมีผลกับความหมายของฟิลด์ที่เหลือ */}
            <section>
                <p className="eyebrow mb-3">ประเภทงาน</p>
                <input type="hidden" name="type" value={type} />

                <div className="grid sm:grid-cols-2 gap-3">
                    <TypeCard
                        active={!isVirtual}
                        onClick={() => setType("ONSITE")}
                        title="วิ่งในงาน"
                        desc="มีวันแข่งและสถานที่จริง ผู้สมัครไม่ต้องส่งผลวิ่ง"
                    />
                    <TypeCard
                        active={isVirtual}
                        onClick={() => setType("VIRTUAL")}
                        title="วิ่งสะสมระยะ (VR)"
                        desc="วิ่งที่ไหนก็ได้ในช่วงเวลาที่กำหนด ผู้สมัครต้องส่งผลวิ่งเอง"
                    />
                </div>

                {isEdit && event?.type !== type && (
                    <Notice tone="danger" className="mt-3">
                        การเปลี่ยนประเภทงานที่มีผู้สมัครแล้วจะกระทบการนับระยะทางและการส่งผล ควรเปลี่ยนเฉพาะตอนยังไม่มีคนสมัคร
                    </Notice>
                )}
            </section>

            <section className="space-y-7">
                <p className="eyebrow">ข้อมูลกิจกรรม</p>
                <Field label="ชื่อกิจกรรม" name="title" required defaultValue={event?.title} placeholder={isVirtual ? "Virtual Run สะสมระยะ 100 กม." : "สันป่าตอง Trail Run 2026"} />
                <TextArea label="รายละเอียด" name="description" rows={5} required defaultValue={event?.description} placeholder="เส้นทาง จุดนัดพบ สิ่งที่ผู้เข้าร่วมจะได้รับ" />
                <div className="grid sm:grid-cols-2 gap-7">
                    <Field
                        label={isVirtual ? "ข้อความสถานที่" : "สถานที่"}
                        name="location" required
                        defaultValue={event?.location ?? (isVirtual ? "วิ่งที่ไหนก็ได้" : "")}
                        placeholder={isVirtual ? "วิ่งที่ไหนก็ได้" : "สวนสาธารณะหนองบวก"}
                        helper={isVirtual ? "ข้อความที่แสดงแทนสถานที่จริง" : undefined}
                    />
                    <Select label="จังหวัด" name="province" defaultValue={event?.province ?? ""}>
                        <option value="">{isVirtual ? "ไม่ระบุ (แนะนำสำหรับงาน VR)" : "ไม่ระบุ"}</option>
                        {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </Select>
                </div>

                <Field label="ผู้จัดงาน" name="organizer" defaultValue={event?.organizer ?? ""} placeholder="ชื่อผู้จัด / องค์กร" />

                <div className="grid sm:grid-cols-2 gap-7">
                    <Field
                        label={isVirtual ? "วันเริ่มสะสมระยะ" : "วันและเวลาแข่ง"}
                        name="date" type="datetime-local" required
                        defaultValue={event ? formatDateTimeInput(event.date) : ""}
                        helper={isVirtual ? "วันแรกที่ส่งผลวิ่งได้" : undefined}
                    />
                    <Field
                        label={isVirtual ? "วันสุดท้ายที่ส่งผลได้" : "วัน/เวลาสิ้นสุด"}
                        name="endDate" type="datetime-local"
                        required={isVirtual}
                        defaultValue={event?.endDate ? formatDateTimeInput(event.endDate) : ""}
                        helper={isVirtual ? "จำเป็นสำหรับงานสะสมระยะ" : "เว้นว่างได้ถ้าจบวันเดียวกัน"}
                    />
                </div>
            </section>

            <section className="space-y-7">
                <p className="eyebrow">ช่วงรับสมัคร</p>
                <div className="grid sm:grid-cols-2 gap-7">
                    <Field
                        label="เปิดรับสมัคร" name="registerOpenAt" type="datetime-local"
                        defaultValue={event?.registerOpenAt ? formatDateTimeInput(event.registerOpenAt) : ""}
                        helper="เว้นว่าง = เปิดรับทันที"
                    />
                    <Field
                        label="ปิดรับสมัคร" name="registerCloseAt" type="datetime-local"
                        defaultValue={event?.registerCloseAt ? formatDateTimeInput(event.registerCloseAt) : ""}
                        helper="เว้นว่าง = ปิดเมื่อถึงวันจัดงาน"
                    />
                </div>
            </section>

            {/* ตอนสร้าง: ใส่ได้หลายระยะเลย / ตอนแก้ไข: จัดการที่ตาราง "ประเภทการแข่งขัน" ด้านบนของหน้า */}
            {isEdit ? (
                <section className="space-y-5">
                    <p className="eyebrow">{isVirtual ? "ระยะเป้าหมายและค่าสมัคร" : "ระยะและค่าสมัคร"}</p>
                    <Notice tone="neutral">
                        แก้ไขได้ที่หัวข้อ &ldquo;ประเภทการแข่งขัน&rdquo; ด้านบนของหน้านี้
                    </Notice>
                    {/* ค่าหัวเรื่องของงาน ระบบคำนวณจากระยะที่มีอยู่ ไม่ต้องให้กรอกซ้ำ */}
                    <input type="hidden" name="distance" value={event?.distance ?? 0} />
                    <input type="hidden" name="price" value={event?.price ?? 0} />
                </section>
            ) : (
                <CategoryRows isVirtual={isVirtual} />
            )}

            <section className="space-y-7">
                <p className="eyebrow">การรับสมัครรวม</p>
                <Field
                    label="จำนวนรับสมัครรวมทั้งงาน" name="maxParticipants" type="number" step="1" min="1"
                    defaultValue={event?.maxParticipants ?? ""}
                    placeholder="เว้นว่าง = ไม่จำกัด"
                    helper="จำกัดรวมทุกระยะ — จำนวนของแต่ละระยะตั้งแยกได้"
                />
                <Select label="สถานะ" name="status" defaultValue={event?.status ?? "OPEN"}>
                    <option value="OPEN">เปิดรับสมัคร</option>
                    <option value="CLOSED">ปิดรับสมัคร</option>
                    <option value="CANCELLED">ยกเลิกกิจกรรม</option>
                </Select>
            </section>

            <section className="space-y-7">
                <p className="eyebrow">ข้อมูลเพิ่มเติม</p>

                <TextArea
                    label="สิ่งที่ผู้สมัครจะได้รับ" name="rewards" rows={3}
                    defaultValue={event?.rewards ?? ""}
                    placeholder="เสื้อวิ่ง, เหรียญที่ระลึก, BIB, อาหารว่างหลังวิ่ง"
                />

                <div className="grid sm:grid-cols-2 gap-7">
                    <Field
                        label="ลิงก์ติดตามรายละเอียด" name="contactUrl" type="url"
                        defaultValue={event?.contactUrl ?? ""}
                        placeholder="https://facebook.com/..."
                        helper="เพจหรือเว็บของผู้จัด"
                    />
                    <Field
                        label="วันประกาศผล" name="announceAt" type="date"
                        defaultValue={event?.announceAt ? formatDateInput(event.announceAt) : ""}
                    />
                </div>
            </section>

            <section>
                <p className="eyebrow mb-3">รูปปกกิจกรรม</p>
                <label
                    htmlFor="image"
                    className="flex flex-col items-center justify-center gap-2 w-full min-h-40 p-5 rounded-3xl border border-dashed border-line hover:border-ink-mute cursor-pointer transition-colors"
                >
                    {preview ? (
                        <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={preview} alt="ตัวอย่างรูปปก" className="max-h-52 rounded-xl object-contain" />
                            <span className="eyebrow text-ink mt-1">เปลี่ยนรูป</span>
                        </>
                    ) : (
                        <>
                            <span className="text-sm font-semibold">เลือกรูปปก</span>
                            <span className="text-[11px] text-ink-mute">JPG, PNG, WEBP · ไม่เกิน 5MB</span>
                        </>
                    )}
                </label>
                <input
                    id="image"
                    type="file"
                    name="image"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) setPreview(URL.createObjectURL(f))
                    }}
                />
                <p className="text-[11px] text-ink-mute mt-2">
                    แนะนำภาพแนวนอนกว้าง เช่น 1250 × 464 px
                </p>
            </section>

            {!isEdit && (
                <section>
                    <p className="eyebrow mb-1">รูปประกอบ</p>
                    <p className="text-[12px] text-ink-mute mb-4">
                        แยกตามหมวดเพื่อให้แสดงเป็นกลุ่มในหน้างาน — ไม่บังคับสักหมวด เพิ่มภายหลังได้
                    </p>

                    <div className="space-y-3">
                        {IMAGE_GROUPS.map((g) => (
                            <ImageGroupInput key={g.key} group={g} />
                        ))}
                    </div>
                </section>
            )}

            {error && <Notice tone="danger">{error}</Notice>}

            <div className="flex gap-3">
                <Link href="/admin/events" className={buttonClass("outline", "md", "flex-1 sm:flex-none")}>
                    ยกเลิก
                </Link>
                <Button type="submit" className="flex-1 sm:flex-none" disabled={pending}>
                    {pending ? <Spinner /> : isEdit ? "บันทึกการแก้ไข" : "สร้างกิจกรรม"}
                </Button>
            </div>
        </form>
    )
}

/** การ์ดเลือกประเภทงาน — อธิบายความต่างให้เห็นตั้งแต่ตอนเลือก */
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

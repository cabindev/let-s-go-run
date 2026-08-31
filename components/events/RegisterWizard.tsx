'use client'

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Card } from "@/components/ui/Card"
import { Button, Spinner } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"
import { Field, TextArea, inputClass } from "@/components/ui/Field"
import { Stepper, REGISTER_STEPS } from "./Stepper"
import { submitRegistration } from "@/app/actions/register-flow"
import { SHIRT_SIZES, type Option } from "@/lib/events"
import { cn, formatDate, formatDateRange, formatPrice, formatTime } from "@/lib/utils"

interface Props {
    event: {
        id: string
        title: string
        date: string
        endDate?: string | null
        location: string
        image: string | null
        type: "ONSITE" | "VIRTUAL"
    }
    options: (Option & { taken: number })[]
    /** ค่าเริ่มต้นจากโปรไฟล์ผู้ใช้ */
    defaults: { fullName: string; phone: string }
}

interface Details {
    fullName: string
    phone: string
    shirtSize: string
    address: string
    emergencyName: string
    emergencyPhone: string
}

export function RegisterWizard({ event, options, defaults }: Props) {
    const router = useRouter()
    const [step, setStep] = useState(0)
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    const available = options.filter((o) => !o.maxSlots || o.taken < o.maxSlots)
    const [selected, setSelected] = useState<Option | null>(available.length === 1 ? available[0] : null)

    const isVirtual = event.type === "VIRTUAL"
    const base = isVirtual ? `/virtual/${event.id}` : `/events/${event.id}`

    const [details, setDetails] = useState<Details>({
        fullName: defaults.fullName,
        phone: defaults.phone,
        shirtSize: "M",
        address: "",
        emergencyName: "",
        emergencyPhone: "",
    })

    const set = (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setDetails((d) => ({ ...d, [k]: e.target.value }))

    const goto = (n: number) => {
        setError(null)
        setStep(n)
        window.scrollTo({ top: 0, behavior: "smooth" })
    }

    // ---- ขั้น 1: เลือกประเภท ----
    const nextFromCategory = () => {
        if (!selected) return setError("กรุณาเลือกประเภทการแข่งขัน")
        goto(1)
    }

    // ---- ขั้น 2: ข้อมูลผู้สมัคร ----
    const nextFromDetails = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!details.fullName.trim()) return setError("กรุณากรอกชื่อ-นามสกุล")
        if (details.phone.trim().length < 8) return setError("เบอร์โทรศัพท์ไม่ถูกต้อง")
        goto(2)
    }

    // ---- ขั้น 3: ยืนยัน ----
    const confirm = () => {
        if (!selected) return
        setError(null)
        const fd = new FormData()
        fd.set("eventId", event.id)
        fd.set("categoryId", selected.id ?? "")
        fd.set("fullName", details.fullName)
        fd.set("phone", details.phone)
        fd.set("shirtSize", details.shirtSize)
        fd.set("address", details.address)
        fd.set("emergencyName", details.emergencyName)
        fd.set("emergencyPhone", details.emergencyPhone)

        startTransition(async () => {
            const res = await submitRegistration(fd)
            if (!res.ok) {
                setError(res.error)
                return
            }
            if (res.needsPayment) {
                router.push(`/payment/${res.registrationId}?from=register`)
            } else {
                router.push(`${base}?joined=1`)
            }
            router.refresh()
        })
    }

    return (
        <div className="pt-4 max-w-2xl mx-auto space-y-8">
            <Link
                href={base}
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors"
            >
                <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                กลับไปหน้างาน
            </Link>

            {/* หัวข้อ + ขั้นตอน */}
            <div>
                <p className="eyebrow">สมัครเข้าร่วม</p>
                <h1 className="display text-2xl sm:text-3xl mt-2">{event.title}</h1>
                <p className="text-[13px] text-ink-mute mt-2 tnum">
                    {isVirtual
                        ? `สะสมระยะได้ระหว่าง ${formatDateRange(event.date, event.endDate)}`
                        : `${formatDate(event.date)} · ${formatTime(event.date)} · ${event.location}`}
                </p>
            </div>

            <div className="overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0">
                <Stepper steps={REGISTER_STEPS} current={step} />
            </div>

            {error && <Notice tone="danger">{error}</Notice>}

            {/* ---------- ขั้น 1 ---------- */}
            {step === 0 && (
                <div className="space-y-5">
                    <p className="eyebrow">{isVirtual ? "เลือกระยะเป้าหมาย" : "เลือกประเภทการแข่งขัน"}</p>

                    {available.length === 0 ? (
                        <Notice tone="danger" title="ที่นั่งเต็มทุกประเภทแล้ว">
                            ลองติดตามงานอื่นในหน้าแรก
                        </Notice>
                    ) : (
                        <ul className="space-y-3">
                            {options.map((o) => {
                                const full = !!o.maxSlots && o.taken >= o.maxSlots
                                const active = selected?.id === o.id && selected?.name === o.name
                                return (
                                    <li key={o.id ?? "default"}>
                                        <button
                                            type="button"
                                            disabled={full}
                                            onClick={() => { setSelected(o); setError(null) }}
                                            className={cn(
                                                "w-full text-left p-4 sm:p-5 rounded-2xl border transition-colors",
                                                full && "opacity-45 cursor-not-allowed border-line",
                                                !full && active && "border-ink bg-paper ring-1 ring-ink",
                                                !full && !active && "border-line bg-paper hover:border-ink-mute"
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                    <p className="font-semibold tracking-tight">{o.name}</p>
                                                    <p className="text-[12px] text-ink-mute mt-1 tnum">
                                                        {isVirtual ? `สะสมให้ครบ ${o.distance} กม.` : `${o.distance} กม.`}
                                                        {o.maxSlots && ` · เหลือ ${Math.max(0, o.maxSlots - o.taken)}/${o.maxSlots} ที่`}
                                                    </p>
                                                    {full && <p className="text-[12px] text-danger mt-1">เต็มแล้ว</p>}
                                                </div>
                                                <span className="numeral text-xl shrink-0">{formatPrice(o.price)}</span>
                                            </div>
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}

                    <Button size="lg" className="w-full" onClick={nextFromCategory} disabled={!selected}>
                        ถัดไป
                    </Button>
                </div>
            )}

            {/* ---------- ขั้น 2 ---------- */}
            {step === 1 && (
                <form onSubmit={nextFromDetails} className="space-y-7">
                    <p className="eyebrow">ข้อมูลผู้สมัคร</p>

                    <Field label="ชื่อ-นามสกุล" name="fullName" required value={details.fullName} onChange={set("fullName")} placeholder="ชื่อที่ใช้ในการรับของที่ระลึก" />
                    <Field label="เบอร์โทรศัพท์" name="phone" type="tel" required value={details.phone} onChange={set("phone")} placeholder="08x-xxx-xxxx" />

                    <div>
                        <label htmlFor="shirtSize" className="eyebrow block mb-2">ไซส์เสื้อ</label>
                        <select id="shirtSize" value={details.shirtSize} onChange={set("shirtSize")} className={`${inputClass} h-11`}>
                            {SHIRT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <TextArea label="ที่อยู่จัดส่ง" name="address" rows={3} value={details.address} onChange={set("address")} placeholder="สำหรับจัดส่งเสื้อและของที่ระลึก (ถ้ามี)" />

                    <div className="border-t border-line pt-7 space-y-7">
                        <p className="eyebrow">ผู้ติดต่อกรณีฉุกเฉิน</p>
                        <Field label="ชื่อผู้ติดต่อ" name="emergencyName" value={details.emergencyName} onChange={set("emergencyName")} placeholder="ชื่อ-นามสกุล" />
                        <Field label="เบอร์ผู้ติดต่อ" name="emergencyPhone" type="tel" value={details.emergencyPhone} onChange={set("emergencyPhone")} placeholder="08x-xxx-xxxx" />
                    </div>

                    <div className="flex gap-3">
                        <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => goto(0)}>
                            ย้อนกลับ
                        </Button>
                        <Button type="submit" size="lg" className="flex-1">ถัดไป</Button>
                    </div>
                </form>
            )}

            {/* ---------- ขั้น 3 ---------- */}
            {step === 2 && selected && (
                <div className="space-y-7">
                    <p className="eyebrow">ตรวจสอบข้อมูลก่อนยืนยัน</p>

                    <Card className="divide-y divide-line">
                        <Row label="งาน" value={event.title} />
                        <Row label={isVirtual ? "ระยะเป้าหมาย" : "ประเภท"} value={`${selected.name} · ${selected.distance} กม.`} />
                        <Row label="ชื่อ-นามสกุล" value={details.fullName} />
                        <Row label="เบอร์โทรศัพท์" value={details.phone} />
                        <Row label="ไซส์เสื้อ" value={details.shirtSize} />
                        {details.address && <Row label="ที่อยู่จัดส่ง" value={details.address} />}
                        {details.emergencyName && (
                            <Row label="ผู้ติดต่อฉุกเฉิน" value={`${details.emergencyName}${details.emergencyPhone ? ` · ${details.emergencyPhone}` : ""}`} />
                        )}
                    </Card>

                    <div className="flex items-baseline justify-between">
                        <p className="eyebrow">ยอดที่ต้องชำระ</p>
                        <p className="numeral text-3xl">{formatPrice(selected.price)}</p>
                    </div>

                    {selected.price === 0 && (
                        <Notice tone="lime">งานนี้ไม่มีค่าสมัคร กดยืนยันแล้วเข้าร่วมได้ทันที</Notice>
                    )}

                    <div className="flex gap-3">
                        <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => goto(1)} disabled={pending}>
                            ย้อนกลับ
                        </Button>
                        <Button size="lg" className="flex-1" onClick={confirm} disabled={pending}>
                            {pending ? <Spinner /> : selected.price > 0 ? "ยืนยันและไปชำระเงิน" : "ยืนยันการสมัคร"}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-4 px-5 py-3.5">
            <dt className="text-[13px] text-ink-mute shrink-0">{label}</dt>
            <dd className="text-sm font-medium text-right break-words min-w-0">{value}</dd>
        </div>
    )
}

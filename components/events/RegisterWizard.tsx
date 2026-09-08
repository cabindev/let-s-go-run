'use client'

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
    ArrowLeft, CalendarDays, Check, ClipboardCheck, Flag, HeartPulse,
    IdCard, MapPin, Phone, Route, ShieldCheck, Shirt, Ticket, User, type LucideIcon,
} from "lucide-react"
import { Card } from "@/components/ui/Card"
import { Button, Spinner } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"
import { Field, TextArea, inputClass } from "@/components/ui/Field"
import { Stepper, REGISTER_STEPS } from "./Stepper"
import { InviteCodeBox, type AppliedInvite } from "./InviteCodeBox"
import { discountedPrice } from "@/lib/invite-codes"
import { submitRegistration } from "@/app/actions/register-flow"
import { SHIRT_SIZES, SHIRT_SIZE_CHART, GENDER_OPTIONS, BLOOD_TYPES, DEFAULT_PDPA_NOTICE, SHIPPING_FEE, AVAILABILITY_TONE, registrationAmount, categoryAvailability, type Option } from "@/lib/events"
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
        collectGender: boolean
        collectBloodType: boolean
        collectNationalId: boolean
        collectPreviousParticipation: boolean
        collectDateOfBirth: boolean
        offerShipping: boolean
        pdpaNotice: string | null
    }
    options: (Option & { taken: number })[]
    /** ค่าเริ่มต้นจากโปรไฟล์ผู้ใช้ */
    defaults: { fullName: string; phone: string; dateOfBirth: string }
}

interface Details {
    fullName: string
    phone: string
    shirtSize: string
    address: string
    emergencyName: string
    emergencyPhone: string
    gender: string
    bloodType: string
    nationalId: string
    hasParticipatedBefore: string
    deliveryMethod: string
    dateOfBirth: string
    hasMedicalCondition: string
    medicalConditionDetail: string
}

export function RegisterWizard({ event, options, defaults }: Props) {
    const router = useRouter()
    const [step, setStep] = useState(0)
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [pdpaConsent, setPdpaConsent] = useState(false)
    const pdpaNotice = event.pdpaNotice?.trim() || DEFAULT_PDPA_NOTICE

    /**
     * โค้ดสิทธิพิเศษ — มีผลกับราคาทุกรุ่น วิธีรับของ และการเช็คที่นั่งเต็ม
     * จึงอยู่ที่ขั้นแรกสุด ก่อนผู้สมัครเลือกอะไร
     */
    const [invite, setInvite] = useState<AppliedInvite | null>(null)

    /** ราคาที่ผู้สมัครคนนี้ต้องจ่ายจริงต่อรุ่น — ฝั่งเซิร์ฟเวอร์คำนวณซ้ำเองอยู่แล้ว ตรงนี้แค่แสดงผล */
    const priceOf = (o: Option) => (invite ? discountedPrice(o.price, invite.discountPercent) : o.price)

    // ที่นั่งสิทธิพิเศษอยู่นอกโควตา คนถือโค้ดจึงเลือกรุ่นที่เต็มแล้วได้
    const available = options.filter((o) => invite || !o.maxSlots || o.taken < o.maxSlots)
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
        gender: "",
        bloodType: "",
        nationalId: "",
        hasParticipatedBefore: "",
        deliveryMethod: "",
        dateOfBirth: defaults.dateOfBirth,
        hasMedicalCondition: "",
        medicalConditionDetail: "",
    })

    const set = (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setDetails((d) => ({ ...d, [k]: e.target.value }))

    /**
     * สิทธิ์ที่ทำให้ค่าสมัครเป็นศูนย์ = รับของที่งานเท่านั้น
     * (เซิร์ฟเวอร์ทับค่าเป็น PICKUP อีกชั้นเสมอ ตรงนี้แค่ทำให้หน้าจอตรงกับที่จะเกิดขึ้นจริง)
     */
    const entryFee = selected ? priceOf(selected) : 0
    const forcePickup = !!invite && !!selected && entryFee <= 0
    const deliveryMethod = forcePickup ? "PICKUP" : details.deliveryMethod
    const totalAmount = selected ? registrationAmount(entryFee, deliveryMethod) : 0

    const goto = (n: number) => {
        setError(null)
        setStep(n)
        window.scrollTo({ top: 0, behavior: "smooth" })
    }

    /**
     * แจ้งข้อผิดพลาดแล้วเลื่อนจอขึ้นไปหาข้อความ
     *
     * กล่องแจ้งเตือนอยู่หัวหน้าจอ แต่ปุ่ม "ถัดไป" อยู่ท้ายฟอร์มที่ยาวเกินหนึ่งจอ
     * ถ้าไม่เลื่อนให้ ผู้สมัครจะเห็นแค่ปุ่มที่กดแล้วไม่ไปไหน โดยไม่รู้ว่ามีข้อความบอกเหตุผลอยู่
     */
    const fail = (message: string) => {
        setError(message)
        window.scrollTo({ top: 0, behavior: "smooth" })
    }

    // ---- ขั้น 1: เลือกประเภท ----
    const nextFromCategory = () => {
        if (!selected) return fail("Please select a race category / กรุณาเลือกประเภทการแข่งขัน")
        goto(1)
    }

    // ---- ขั้น 2: ข้อมูลผู้สมัคร ----
    const nextFromDetails = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!details.fullName.trim()) return fail("Please enter your full name / กรุณากรอกชื่อ-นามสกุล")
        if (details.phone.trim().length < 8) return fail("Invalid phone number / เบอร์โทรศัพท์ไม่ถูกต้อง")
        if (event.collectNationalId && !/^\d{13}$/.test(details.nationalId.trim())) {
            return fail("Please enter a valid 13-digit national ID / กรุณากรอกเลขบัตรประชาชนให้ครบ 13 หลัก")
        }
        if (event.collectPreviousParticipation && !details.hasParticipatedBefore) {
            return fail("Please specify if you've joined this event before / กรุณาระบุว่าเคยเข้าร่วมกิจกรรมนี้มาก่อนหรือไม่")
        }
        if (event.collectDateOfBirth && !details.dateOfBirth) {
            return fail("Please enter your date of birth / กรุณากรอกวันเกิด")
        }
        if (event.collectBloodType && !details.hasMedicalCondition) {
            return fail("Please specify if you have any medical conditions / กรุณาระบุว่ามีโรคประจำตัวหรือไม่")
        }
        if (details.hasMedicalCondition === "YES" && !details.medicalConditionDetail.trim()) {
            return fail("Please specify your medical condition / กรุณาระบุรายละเอียดโรคประจำตัว")
        }
        if (event.offerShipping && !forcePickup && !details.deliveryMethod) {
            return fail("Please choose a delivery method / กรุณาเลือกวิธีรับของ")
        }
        if (deliveryMethod === "SHIPPING" && !details.address.trim()) {
            return fail("Please enter a shipping address / กรุณากรอกที่อยู่จัดส่งสำหรับการส่งไปรษณีย์")
        }
        goto(2)
    }

    // ---- ขั้น 3: ยืนยัน ----
    const confirm = () => {
        if (!selected) return
        if (!pdpaConsent) return setError("Please accept the PDPA notice / กรุณายอมรับข้อความ PDPA ก่อนสมัคร")
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
        fd.set("gender", details.gender)
        fd.set("bloodType", details.bloodType)
        fd.set("nationalId", details.nationalId)
        fd.set("hasParticipatedBefore", details.hasParticipatedBefore)
        fd.set("deliveryMethod", deliveryMethod)
        fd.set("dateOfBirth", details.dateOfBirth)
        fd.set("hasMedicalCondition", details.hasMedicalCondition)
        fd.set("medicalConditionDetail", details.medicalConditionDetail)
        fd.set("pdpaConsent", "1")
        if (invite) fd.set("inviteCode", invite.code)

        startTransition(async () => {
            const res = await submitRegistration(fd)
            if (!res.ok) {
                fail(res.error)
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
        <div className="pt-4 max-w-2xl mx-auto space-y-6">
            <Link
                href={base}
                className="inline-flex items-center gap-2 text-[15px] font-semibold text-ink-mute hover:text-ink transition-colors"
            >
                <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                Back to Event / กลับไปหน้างาน
            </Link>

            {/*
              หัวงาน + แถบขั้นตอนอยู่ในการ์ดใบเดียวกัน
              ผู้สมัครจะได้เห็นพร้อมกันว่า "กำลังสมัครงานไหน" และ "อยู่ขั้นที่เท่าไร"
              โดยไม่ต้องกวาดตาข้ามช่องว่างสองก้อน
            */}
            <Card className="raise-lg overflow-hidden">
                <div className="flex gap-4 p-4 sm:p-5">
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-2xl overflow-hidden bg-paper-3">
                        {event.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={event.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <span className="absolute inset-0 flex items-center justify-center text-ink-mute/40">
                                <Route className="w-8 h-8" strokeWidth={1.5} />
                            </span>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="eyebrow">Register / สมัครเข้าร่วม</p>
                        <h1 className="display text-xl sm:text-2xl mt-1">{event.title}</h1>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-ink-mute mt-2 tnum">
                            <span className="inline-flex items-center gap-1.5">
                                <CalendarDays className="w-4 h-4 shrink-0" strokeWidth={1.9} />
                                {isVirtual ? formatDateRange(event.date, event.endDate) : `${formatDate(event.date)} · ${formatTime(event.date)}`}
                            </span>
                            <span className="inline-flex items-center gap-1.5 min-w-0">
                                {isVirtual ? (
                                    <><Route className="w-4 h-4 shrink-0" strokeWidth={1.9} />วิ่งที่ไหนก็ได้</>
                                ) : (
                                    <><MapPin className="w-4 h-4 shrink-0" strokeWidth={1.9} /><span className="truncate">{event.location}</span></>
                                )}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="border-t border-line bg-paper-2/60 px-4 sm:px-5 py-3 overflow-x-auto no-scrollbar">
                    <Stepper steps={REGISTER_STEPS} current={step} />
                </div>
            </Card>

            {error && <Notice tone="danger">{error}</Notice>}

            {/* ---------- ขั้น 1 ---------- */}
            {step === 0 && (
                <div className="space-y-5">
                    <SectionHead
                        icon={Flag}
                        title={isVirtual ? "เลือกระยะเป้าหมาย" : "เลือกประเภทการแข่งขัน"}
                        desc={isVirtual ? "Select target distance" : "Select race category"}
                    />

                    {available.length === 0 ? (
                        <>
                            <Notice tone="danger" title="Sold Out / ที่นั่งเต็มทุกประเภทแล้ว">
                                Check out other events on the home page / ลองติดตามงานอื่นในหน้าแรก
                            </Notice>
                            {/* ที่นั่งเต็มไม่ได้แปลว่าคนถือสิทธิพิเศษหมดสิทธิ์ — โควตาเขาแยกกันคนละก้อน */}
                            <InviteCodeBox eventId={event.id} applied={invite} onApply={setInvite} />
                        </>
                    ) : (
                        <ul className="space-y-3">
                            {options.map((o) => {
                                const availability = categoryAvailability(o.taken, o.maxSlots)
                                const full = availability.full && !invite
                                const availabilityLabel = invite ? "ใช้โค้ดได้" : availability.label
                                const tone = invite ? "lime" : availability.tone
                                const finalPrice = priceOf(o)
                                const active = selected?.id === o.id && selected?.name === o.name
                                return (
                                    <li key={o.id ?? "default"}>
                                        <button
                                            type="button"
                                            disabled={full}
                                            aria-pressed={active}
                                            onClick={() => { setSelected(o); setError(null) }}
                                            className={cn(
                                                "w-full text-left p-4 sm:p-5 rounded-3xl border bg-paper transition-all",
                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper-2",
                                                full && "opacity-45 cursor-not-allowed border-line",
                                                !full && active && "border-ink ring-1 ring-ink raise-lg",
                                                !full && !active && "border-line raise hover:border-ink-mute"
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <span
                                                        aria-hidden
                                                        className={cn(
                                                            "mt-0.5 shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                                                            active ? "border-ink bg-ink text-white" : "border-line"
                                                        )}
                                                    >
                                                        {active && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="font-semibold tracking-tight">{o.name}</p>
                                                            {/* ป้ายสถานะใช้ตัวอักษรเล็กแบบเดียวกับ .eyebrow แต่เขียนคลาสเอง
                                                                เพราะ .eyebrow บังคับสีเทาไว้ในตัว จะทับสีเขียว/แดงของสถานะจนหายไปหมด */}
                                                            <span className={cn(
                                                                "shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] whitespace-nowrap",
                                                                AVAILABILITY_TONE[tone]
                                                            )}>
                                                                {availabilityLabel}
                                                            </span>
                                                        </div>
                                                        <p className="flex items-center gap-1.5 text-[14px] text-ink-mute mt-1.5 tnum">
                                                            <Route className="w-4 h-4 shrink-0" strokeWidth={1.9} />
                                                            {isVirtual ? `สะสมให้ครบ ${o.distance} กม.` : `${o.distance} กม.`}
                                                            {!invite && o.maxSlots && ` · เหลือ ${Math.max(0, o.maxSlots - o.taken)}/${o.maxSlots} ที่`}
                                                        </p>
                                                    </div>
                                                </div>
                                                {/* มีส่วนลดให้ขีดฆ่าราคาเดิมไว้ เพื่อให้เห็นว่าสิทธิ์ถูกใช้จริงแล้ว */}
                                                <span className="shrink-0 text-right">
                                                    {finalPrice !== o.price && (
                                                        <span className="block text-[13px] text-ink-mute line-through tnum">
                                                            {formatPrice(o.price)}
                                                        </span>
                                                    )}
                                                    <span className="numeral text-2xl">{formatPrice(finalPrice)}</span>
                                                </span>
                                            </div>
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}

                    {available.length > 0 && (
                        <InviteCodeBox eventId={event.id} applied={invite} onApply={setInvite} />
                    )}

                    <Button size="lg" className="w-full" onClick={nextFromCategory} disabled={!selected}>
                        Next / ถัดไป
                    </Button>
                </div>
            )}

            {/* ---------- ขั้น 2 ---------- */}
            {step === 1 && selected && (
                <form onSubmit={nextFromDetails} className="space-y-4">
                    {/* สรุปสิ่งที่เลือกไว้ พร้อมทางกลับไปแก้ — ไม่ต้องกดย้อนกลับเพื่อไปดูว่าเลือกรุ่นไหนไว้ */}
                    <div className="raise rounded-3xl border border-line bg-paper px-4 sm:px-5 py-4 flex items-center gap-4">
                        <span className="w-11 h-11 shrink-0 rounded-2xl bg-ink text-white flex items-center justify-center">
                            <Ticket className="w-5 h-5" strokeWidth={1.9} />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold tracking-tight truncate">
                                {selected.name} · {selected.distance} กม.
                            </p>
                            <p className="text-[13px] text-ink-mute mt-0.5 tnum">
                                ค่าสมัคร {formatPrice(entryFee)}
                                {invite && ` · ${invite.groupName}`}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => goto(0)}
                            className="eyebrow shrink-0 text-ink-mute hover:text-ink transition-colors"
                        >
                            แก้ไข
                        </button>
                    </div>

                    <Section icon={User} title="ข้อมูลผู้สมัคร" desc="Participant information">
                        <Field
                            label="Full Name / ชื่อ-นามสกุล" name="fullName" required
                            value={details.fullName} onChange={set("fullName")}
                            placeholder="ชื่อที่ใช้ในการรับของที่ระลึก"
                        />

                        <div>
                            <label htmlFor="phone" className="eyebrow block mb-2">
                                Phone Number / เบอร์โทรศัพท์<span className="text-danger ml-1">*</span>
                            </label>
                            <div className="relative">
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-sm text-ink-mute pointer-events-none">
                                    🇹🇭 <span className="tnum">+66</span>
                                </span>
                                <input
                                    id="phone" name="phone" type="tel" required
                                    value={details.phone} onChange={set("phone")}
                                    placeholder="8x-xxx-xxxx"
                                    className={`${inputClass} h-11 pl-[4.25rem]`}
                                />
                            </div>
                        </div>

                        {event.collectDateOfBirth && (
                            <Field
                                label="Date of Birth / วันเกิด" name="dateOfBirth" type="date" required
                                value={details.dateOfBirth} onChange={set("dateOfBirth")}
                            />
                        )}

                        {event.collectGender && (
                            <ChipGroup
                                label="Gender / เพศ"
                                name="gender"
                                value={details.gender}
                                onChange={set("gender")}
                                options={GENDER_OPTIONS.map((g) => ({ value: g.value, label: g.label }))}
                            />
                        )}
                    </Section>

                    <Section icon={Shirt} title="เสื้อและการรับของ" desc="Shirt size & delivery">
                        <fieldset>
                            <legend className="eyebrow mb-2">Shirt Size / ไซส์เสื้อ</legend>
                            {/* ปุ่มไซส์ความสูงเท่ากันทุกใบ พร้อมรอบอกใต้ตัวอักษร — เลือกได้โดยไม่ต้องเปิดตารางไซส์ */}
                            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                                {SHIRT_SIZES.map((s) => {
                                    const active = details.shirtSize === s
                                    return (
                                        <label key={s} className="relative flex cursor-pointer">
                                            <input
                                                type="radio" name="shirtSize" value={s} checked={active}
                                                onChange={set("shirtSize")} className="peer sr-only"
                                            />
                                            <span
                                                className={cn(
                                                    "w-full h-16 rounded-2xl border flex flex-col items-center justify-center gap-0.5 transition-all",
                                                    "peer-focus-visible:ring-2 peer-focus-visible:ring-ink peer-focus-visible:ring-offset-2",
                                                    active
                                                        ? "border-ink bg-ink text-white raise"
                                                        : "border-line bg-paper text-ink hover:border-ink-mute"
                                                )}
                                            >
                                                <span className="text-sm font-bold tracking-tight">{s}</span>
                                                <span className={cn("text-[11px] tnum", active ? "text-white/65" : "text-ink-mute")}>
                                                    {SHIRT_SIZE_CHART[s]}&quot;
                                                </span>
                                            </span>
                                        </label>
                                    )
                                })}
                            </div>
                            <p className="text-[13px] text-ink-mute mt-2 tnum">
                                ไซส์ {details.shirtSize} — รอบอกประมาณ {SHIRT_SIZE_CHART[details.shirtSize as keyof typeof SHIRT_SIZE_CHART]}&quot;
                            </p>
                        </fieldset>

                        {event.offerShipping && forcePickup && (
                            <Notice tone="sky" title="รับของที่งาน">
                                โค้ดนี้รับของที่หน้างานเท่านั้น ยื่น QR ให้เจ้าหน้าที่สแกนหน้าบูธในวันงาน
                            </Notice>
                        )}

                        {event.offerShipping && !forcePickup && (
                            <ChipGroup
                                label="Delivery Method / วิธีรับของ"
                                name="deliveryMethod"
                                required
                                value={details.deliveryMethod}
                                onChange={set("deliveryMethod")}
                                options={[
                                    { value: "PICKUP", label: "Pick up at venue / รับที่งาน" },
                                    { value: "SHIPPING", label: `Mail delivery / ส่งไปรษณีย์ (+${formatPrice(SHIPPING_FEE)})` },
                                ]}
                                helper={
                                    details.deliveryMethod === "SHIPPING"
                                        ? "Please fill in your shipping address below / กรุณากรอกที่อยู่จัดส่งด้านล่างให้ครบถ้วน"
                                        : "Pick up at the venue by showing your QR code / มารับเองที่งาน โดยยื่น QR ให้เจ้าหน้าที่สแกนหน้าบูธ"
                                }
                            />
                        )}

                        {!forcePickup && (
                            <TextArea
                                label="Shipping Address / ที่อยู่จัดส่ง" name="address" rows={3}
                                required={deliveryMethod === "SHIPPING"}
                                value={details.address} onChange={set("address")}
                                placeholder="สำหรับจัดส่งเสื้อและของที่ระลึก (ถ้ามี)"
                            />
                        )}
                    </Section>

                    {event.collectBloodType && (
                        <Section icon={HeartPulse} title="ข้อมูลทางการแพทย์" desc="Medical information">
                            <ChipGroup
                                label="Blood Type / กรุ๊ปเลือด"
                                name="bloodType"
                                value={details.bloodType}
                                onChange={set("bloodType")}
                                options={BLOOD_TYPES.map((b) => ({ value: b, label: b }))}
                                helper="Emergency use only, optional / ใช้ในกรณีฉุกเฉินเท่านั้น ท่านไม่จำเป็นต้องกรอก"
                            />
                            <ChipGroup
                                label="Do you have any medical conditions? / มีโรคประจำตัวหรือไม่"
                                name="hasMedicalCondition"
                                required
                                value={details.hasMedicalCondition}
                                onChange={set("hasMedicalCondition")}
                                options={[{ value: "NO", label: "No / ไม่มี" }, { value: "YES", label: "Yes / มี" }]}
                            />
                            {details.hasMedicalCondition === "YES" && (
                                <TextArea
                                    label="Please specify / โปรดระบุโรคประจำตัว" name="medicalConditionDetail" rows={2} required
                                    value={details.medicalConditionDetail} onChange={set("medicalConditionDetail")}
                                    placeholder="เช่น โรคหัวใจ, ความดันโลหิตสูง, หอบหืด"
                                    helper="For your safety during the event, so our medical staff can prepare / เพื่อความปลอดภัยของท่านในระหว่างกิจกรรม เจ้าหน้าที่พยาบาลจะได้เตรียมพร้อมได้ถูกต้อง"
                                />
                            )}
                        </Section>
                    )}

                    <Section icon={Phone} title="ผู้ติดต่อกรณีฉุกเฉิน" desc="Emergency contact">
                        <Field
                            label="Contact Name / ชื่อผู้ติดต่อ" name="emergencyName"
                            value={details.emergencyName} onChange={set("emergencyName")} placeholder="ชื่อ-นามสกุล"
                        />
                        <Field
                            label="Contact Phone / เบอร์ผู้ติดต่อ" name="emergencyPhone" type="tel"
                            value={details.emergencyPhone} onChange={set("emergencyPhone")} placeholder="08x-xxx-xxxx"
                        />
                    </Section>

                    {(event.collectNationalId || event.collectPreviousParticipation) && (
                        <Section icon={IdCard} title="ข้อมูลเพิ่มเติม" desc="Additional information">
                            {event.collectNationalId && (
                                <Field
                                    label="National ID / หมายเลขบัตรประชาชน" name="nationalId" required
                                    inputMode="numeric" maxLength={13}
                                    value={details.nationalId} onChange={set("nationalId")}
                                    placeholder="เลข 13 หลัก ไม่ต้องมีขีด"
                                    helper="For accident insurance coverage — must match the registrant's name, stored securely / เพื่อประโยชน์ของผู้เข้าร่วม กรุณากรอกให้ตรงกับชื่อผู้ลงทะเบียน เพื่อสิทธิ์ประกันภัยอุบัติเหตุจากการเข้าร่วมกิจกรรม โดยข้อมูลถูกจัดเก็บอย่างปลอดภัย"
                                />
                            )}
                            {event.collectPreviousParticipation && (
                                <ChipGroup
                                    label="Have you joined this event before? / เคยเข้าร่วมกิจกรรมนี้มาก่อนหรือไม่"
                                    name="hasParticipatedBefore"
                                    required
                                    value={details.hasParticipatedBefore}
                                    onChange={set("hasParticipatedBefore")}
                                    options={[{ value: "YES", label: "Yes / เคย" }, { value: "NO", label: "No / ไม่เคย" }]}
                                />
                            )}
                        </Section>
                    )}

                    <div className="flex gap-3 pt-1">
                        <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => goto(0)}>
                            Back / ย้อนกลับ
                        </Button>
                        <Button type="submit" size="lg" className="flex-1">
                            Next / ถัดไป
                        </Button>
                    </div>
                </form>
            )}

            {/* ---------- ขั้น 3 ---------- */}
            {step === 2 && selected && (
                <div className="space-y-4">
                    <SectionHead icon={ClipboardCheck} title="ตรวจสอบข้อมูลก่อนยืนยัน" desc="Review before confirming" />

                    {/* ใบสรุป — หัวการ์ดบอกงานที่สมัคร ตรงกลางคือข้อมูลที่กรอก ท้ายการ์ดคือยอดเงิน */}
                    <Card className="raise-lg overflow-hidden">
                        <div className="flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-line">
                            <span className="w-10 h-10 shrink-0 rounded-2xl bg-ink text-white flex items-center justify-center">
                                <Ticket className="w-[18px] h-[18px]" strokeWidth={1.9} />
                            </span>
                            <div className="min-w-0">
                                <p className="font-semibold tracking-tight truncate">{event.title}</p>
                                <p className="text-[13px] text-ink-mute mt-0.5 tnum">
                                    {selected.name} · {selected.distance} กม.
                                </p>
                            </div>
                        </div>

                        <dl className="divide-y divide-line">
                            <Row label="Full Name / ชื่อ-นามสกุล" value={details.fullName} />
                            <Row label="Phone Number / เบอร์โทรศัพท์" value={details.phone} />
                            <Row label="Shirt Size / ไซส์เสื้อ" value={details.shirtSize} />
                            {details.address && <Row label="Shipping Address / ที่อยู่จัดส่ง" value={details.address} />}
                            {details.emergencyName && (
                                <Row
                                    label="Emergency Contact / ผู้ติดต่อฉุกเฉิน"
                                    value={`${details.emergencyName}${details.emergencyPhone ? ` · ${details.emergencyPhone}` : ""}`}
                                />
                            )}
                            {details.dateOfBirth && <Row label="Date of Birth / วันเกิด" value={formatDate(details.dateOfBirth)} />}
                            {details.gender && (
                                <Row label="Gender / เพศ" value={GENDER_OPTIONS.find((g) => g.value === details.gender)?.label ?? details.gender} />
                            )}
                            {details.bloodType && <Row label="Blood Type / กรุ๊ปเลือด" value={details.bloodType} />}
                            {event.collectBloodType && details.hasMedicalCondition && (
                                <Row
                                    label="Medical Condition / โรคประจำตัว"
                                    value={details.hasMedicalCondition === "YES" ? details.medicalConditionDetail : "None / ไม่มี"}
                                />
                            )}
                            {details.nationalId && <Row label="National ID / เลขบัตรประชาชน" value={details.nationalId} />}
                            {details.hasParticipatedBefore && (
                                <Row
                                    label="Joined Before / เคยเข้าร่วมมาก่อน"
                                    value={details.hasParticipatedBefore === "YES" ? "Yes / เคย" : "No / ไม่เคย"}
                                />
                            )}
                            {deliveryMethod && (
                                <Row
                                    label="Delivery Method / วิธีรับของ"
                                    value={deliveryMethod === "SHIPPING"
                                        ? `Mail delivery / ส่งไปรษณีย์ (+${formatPrice(SHIPPING_FEE)})`
                                        : "Pick up at venue / รับที่งาน"}
                                />
                            )}
                            {invite && (
                                <Row label="โค้ดที่ใช้" value={`${invite.groupName} · ${invite.code}`} />
                            )}
                        </dl>

                        {/* แจกแจงยอดทีละบรรทัด — ค่าส่งเป็นเงินที่บวกเพิ่มทีหลัง ต้องเห็นว่ามาจากไหน */}
                        <div className="border-t border-line bg-paper-2 px-5 sm:px-6 py-4 space-y-2 tnum">
                            <div className="flex items-baseline justify-between gap-4 text-[14px] text-ink-soft">
                                <span>Entry Fee / ค่าสมัคร</span>
                                <span className="flex items-baseline gap-2">
                                    {invite && entryFee !== selected.price && (
                                        <span className="text-ink-mute line-through">{formatPrice(selected.price)}</span>
                                    )}
                                    <span className="font-semibold text-ink">{formatPrice(entryFee)}</span>
                                </span>
                            </div>
                            {deliveryMethod === "SHIPPING" && (
                                <div className="flex items-baseline justify-between gap-4 text-[14px] text-ink-soft">
                                    <span>Shipping / ค่าจัดส่ง</span>
                                    <span className="font-semibold text-ink">{formatPrice(SHIPPING_FEE)}</span>
                                </div>
                            )}
                            <div className="flex items-baseline justify-between gap-4 pt-3 border-t border-line">
                                <span className="eyebrow">Total / ยอดที่ต้องชำระ</span>
                                <span className="numeral text-3xl">{formatPrice(totalAmount)}</span>
                            </div>
                        </div>
                    </Card>

                    {totalAmount === 0 && (
                        <Notice tone="lime">
                            {invite
                                ? `${invite.groupName} — ไม่มีค่าสมัคร กดยืนยันแล้วได้เลข BIB ทันที`
                                : "This event is free — confirm to join instantly / งานนี้ไม่มีค่าสมัคร กดยืนยันแล้วเข้าร่วมได้ทันที"}
                        </Notice>
                    )}

                    <Section icon={ShieldCheck} title="ความเป็นส่วนตัว (PDPA)" desc="Privacy notice">
                        <div className="max-h-52 overflow-y-auto rounded-2xl border border-line bg-paper-2 p-4 text-[14px] leading-relaxed text-ink-soft whitespace-pre-line">
                            {pdpaNotice}
                        </div>
                        <label className="group flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={pdpaConsent}
                                onChange={(e) => setPdpaConsent(e.target.checked)}
                            />
                            <span
                                className={cn(
                                    "mt-0.5 w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors",
                                    "peer-focus-visible:ring-2 peer-focus-visible:ring-ink peer-focus-visible:ring-offset-2",
                                    pdpaConsent ? "bg-ink border-ink text-white" : "border-line bg-paper group-hover:border-ink-mute"
                                )}
                            >
                                {pdpaConsent && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                            </span>
                            <span className="text-[14px] leading-relaxed text-ink-soft">
                                ข้าพเจ้าได้อ่านและรับทราบข้อความข้างต้น และยินยอมให้เก็บรวบรวม ใช้ หรือเปิดเผยข้อมูลส่วนบุคคลตามวัตถุประสงค์ที่แจ้งไว้
                            </span>
                        </label>
                    </Section>

                    <div className="flex gap-3 pt-1">
                        <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => goto(1)} disabled={pending}>
                            Back / ย้อนกลับ
                        </Button>
                        <Button size="lg" className="flex-1" onClick={confirm} disabled={pending || !pdpaConsent}>
                            {pending ? <Spinner /> : totalAmount > 0 ? "Confirm & Pay / ยืนยันและชำระเงิน" : "Confirm / ยืนยันการสมัคร"}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}

/** หัวข้อกลุ่มคำถาม — ไอคอนในกล่องมน + ชื่อไทยตัวหนา + คำอังกฤษกำกับใต้บรรทัด */
function SectionHead({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc?: string }) {
    return (
        <div className="flex items-start gap-3">
            <span className="w-9 h-9 shrink-0 rounded-xl border border-line bg-paper-2 text-ink-soft flex items-center justify-center">
                <Icon className="w-[18px] h-[18px]" strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
                <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
                {desc && <p className="eyebrow">{desc}</p>}
            </div>
        </div>
    )
}

/**
 * กล่องหนึ่งกลุ่มคำถาม
 *
 * ฟอร์มเดิมเป็นช่องกรอกไล่ลงมายาวเป็นพืด แยกกลุ่มด้วยเส้นคั่นบาง ๆ อย่างเดียว
 * พอซอยเป็นการ์ดทีละเรื่อง สายตาจะรู้ทันทีว่ากำลังตอบเรื่องอะไรอยู่ และเหลืออีกกี่เรื่อง
 */
function Section({ icon, title, desc, children }: {
    icon: LucideIcon
    title: string
    desc?: string
    children: React.ReactNode
}) {
    return (
        <Card className="raise p-5 sm:p-6">
            <SectionHead icon={icon} title={title} desc={desc} />
            <div className="mt-5 space-y-6">{children}</div>
        </Card>
    )
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-3">
            <dt className="text-[13px] text-ink-mute shrink-0 max-w-[45%] pt-0.5">{label}</dt>
            <dd className="text-[15px] font-medium text-right break-words min-w-0">{value}</dd>
        </div>
    )
}

/**
 * ตัวเลือกแบบปุ่มยาแคปซูล — ใช้แทน radio วงกลมของเบราว์เซอร์
 *
 * ปุ่มสูง 44px กดโดนง่ายด้วยนิ้วโป้ง และตัวที่เลือกอยู่กลับสีเป็นพื้นดำ
 * เห็นชัดกว่าจุดเล็ก ๆ ในวงกลม ที่บนจอมือถือกลางแดดแทบมองไม่ออก
 */
function ChipGroup({
    label, name, value, onChange, options, helper, required,
}: {
    label: string
    name: string
    value: string
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    options: { value: string; label: string }[]
    helper?: string
    required?: boolean
}) {
    return (
        <fieldset>
            <legend className="eyebrow mb-2">
                {label}{required && <span className="text-danger ml-1">*</span>}
            </legend>
            <div className="flex flex-wrap gap-2">
                {options.map((o) => {
                    const active = value === o.value
                    return (
                        <label key={o.value} className="relative inline-flex cursor-pointer">
                            <input
                                type="radio"
                                name={name}
                                value={o.value}
                                checked={active}
                                onChange={onChange}
                                className="peer sr-only"
                            />
                            <span
                                className={cn(
                                    "px-4 h-11 inline-flex items-center rounded-full border text-sm font-medium transition-all",
                                    "peer-focus-visible:ring-2 peer-focus-visible:ring-ink peer-focus-visible:ring-offset-2",
                                    active
                                        ? "border-ink bg-ink text-white raise"
                                        : "border-line bg-paper text-ink-soft hover:border-ink-mute hover:bg-paper-2"
                                )}
                            >
                                {o.label}
                            </span>
                        </label>
                    )
                })}
            </div>
            {helper && <p className="text-[13px] text-ink-mute mt-2">{helper}</p>}
        </fieldset>
    )
}

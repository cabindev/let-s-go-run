'use client'

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Download } from "lucide-react"
import type { InviteCode } from "@prisma/client"
import {
    createInviteCodes,
    deleteInviteCode,
    deleteInviteCodeGroup,
    toggleInviteCode,
    updateInviteCodeQuota,
} from "@/app/actions/admin"
import { Button, Spinner } from "@/components/ui/Button"
import { Badge, Notice } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { Field, Select, TextArea, inputClass } from "@/components/ui/Field"
import { ConfirmAction } from "@/components/ui/ConfirmAction"
import { discountLabel } from "@/lib/invite-codes"
import { cn, formatDate } from "@/lib/utils"

interface UsedRegistration {
    id: string
    fullName: string | null
    phone: string | null
    shirtSize: string | null
    email: string | null
    bib: string | null
    categoryName: string | null
    registeredAt: Date
    groupName: string | null
    inviteCodeId: string | null
}

/**
 * ออกและติดตามโค้ดสิทธิพิเศษ จัดกลุ่มตามชื่อกลุ่ม
 *
 * จัดกลุ่มเพราะคำถามที่ต้องตอบจริงคือ "วิริยะ 20 สิทธิ์ ใช้ไปกี่คน" ไม่ใช่ "โค้ดใบนี้สถานะอะไร"
 * แอดมินตั้งรหัสเองไม่ได้ — รหัสที่คนตั้งเอง (FREE2026, VIRIYAH20) เดาได้ในไม่กี่ครั้ง
 */
export function InviteCodeManager({
    eventId,
    codes,
    issued,
    used,
    registrations,
}: {
    eventId: string
    codes: InviteCode[]
    issued: number
    used: number
    registrations: UsedRegistration[]
}) {
    const router = useRouter()
    const formRef = useRef<HTMLFormElement>(null)
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [open, setOpen] = useState(codes.length === 0)
    const [mode, setMode] = useState<"PER_PERSON" | "SINGLE">("PER_PERSON")
    const [copied, setCopied] = useState<string | null>(null)
    const [expanded, setExpanded] = useState<string | null>(null)

    const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => {
        setError(null)
        setNotice(null)
        startTransition(async () => {
            const res = await fn()
            if (!res.ok) setError(res.error ?? "ทำรายการไม่สำเร็จ")
            else {
                setNotice(res.message ?? null)
                router.refresh()
            }
        })
    }

    const create = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        fd.set("eventId", eventId)
        run(async () => {
            const res = await createInviteCodes(fd)
            if (res.ok) formRef.current?.reset()
            return res
        })
    }

    const copy = async (text: string, key: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopied(key)
            setTimeout(() => setCopied(null), 1800)
        } catch {
            setError("คัดลอกไม่สำเร็จ กรุณาเลือกข้อความแล้วคัดลอกเอง")
        }
    }

    // จัดกลุ่มตามชื่อกลุ่ม — หนึ่งกลุ่มอาจมีโค้ดใบเดียว (แจกทั้งกลุ่ม) หรือหลายใบ (ใบละคน)
    const groups = new Map<string, InviteCode[]>()
    for (const c of codes) {
        const list = groups.get(c.groupName) ?? []
        list.push(c)
        groups.set(c.groupName, list)
    }

    return (
        <section className="space-y-6">
            <div className="flex items-baseline justify-between gap-4">
                <div>
                    <p className="eyebrow">โค้ดสิทธิพิเศษ</p>
                    {codes.length > 0 && (
                        <p className="text-[11px] text-ink-mute tnum mt-1">
                            ออกไปแล้ว {issued} สิทธิ์ · ใช้ไป {used} · เหลือ {issued - used}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                    {codes.length > 0 && (
                        <a
                            href={`/api/admin/invite-codes/export?event=${eventId}`}
                            className="eyebrow text-ink-soft hover:text-ink transition-colors inline-flex items-center gap-1.5"
                        >
                            <Download className="w-3.5 h-3.5" strokeWidth={2.2} />
                            Excel ทั้งงาน
                        </a>
                    )}
                    {!open && (
                        <button
                            type="button"
                            onClick={() => setOpen(true)}
                            className="eyebrow text-ink hover:text-ink-soft transition-colors"
                        >
                            + ออกโค้ดใหม่
                        </button>
                    )}
                </div>
            </div>

            {error && <Notice tone="danger" title="ทำรายการไม่สำเร็จ">{error}</Notice>}
            {notice && <Notice tone="lime" title="สำเร็จ">{notice}</Notice>}

            {open && (
                <Card className="p-6 sm:p-8">
                    <form ref={formRef} onSubmit={create} className="space-y-6">
                        <div className="grid gap-6 sm:grid-cols-2">
                            <Field
                                label="ชื่อกลุ่ม"
                                name="groupName"
                                required
                                maxLength={120}
                                placeholder="วิริยะประกันภัย"
                                helper="ใช้จัดกลุ่มและรายงานกลับให้สปอนเซอร์ ผู้สมัครไม่เห็นชื่อนี้"
                            />
                            <Field
                                label="จำนวนสิทธิ์"
                                name="quantity"
                                type="number"
                                min={1}
                                max={500}
                                defaultValue={20}
                                required
                                helper="จำนวนคนที่ใช้ได้ ไม่ใช่จำนวนใบโค้ด"
                            />
                        </div>

                        <div>
                            <p className="eyebrow mb-2">รูปแบบโค้ด</p>
                            <div className="space-y-2">
                                <label className="flex gap-3 items-start cursor-pointer">
                                    <input
                                        type="radio"
                                        name="mode"
                                        value="PER_PERSON"
                                        checked={mode === "PER_PERSON"}
                                        onChange={() => setMode("PER_PERSON")}
                                        className="mt-1"
                                    />
                                    <span className="text-[13px] leading-relaxed">
                                        <strong>โค้ดใช้ครั้งเดียว ใบละคน</strong> — รั่วไม่ได้ ตามได้รายคน
                                        <span className="block text-ink-mute text-[12px]">
                                            แนะนำสำหรับสปอนเซอร์ที่เป็นคู่สัญญา
                                        </span>
                                    </span>
                                </label>
                                <label className="flex gap-3 items-start cursor-pointer">
                                    <input
                                        type="radio"
                                        name="mode"
                                        value="SINGLE"
                                        checked={mode === "SINGLE"}
                                        onChange={() => setMode("SINGLE")}
                                        className="mt-1"
                                    />
                                    <span className="text-[13px] leading-relaxed">
                                        <strong>โค้ดเดียวแจกทั้งกลุ่ม</strong> — สะดวก แต่ส่งต่อกันได้
                                        <span className="block text-ink-mute text-[12px]">
                                            เหมาะกับแขกผู้จัดงานหรือทีมงานที่ยังไม่รู้รายชื่อ
                                        </span>
                                    </span>
                                </label>
                            </div>
                        </div>

                        <div className="grid gap-6 sm:grid-cols-2">
                            <Select label="ส่วนลด" name="discountPercent" defaultValue="100">
                                <option value="100">100% — ฟรี ไม่มีค่าสมัคร</option>
                                <option value="50">50%</option>
                                <option value="30">30%</option>
                                <option value="20">20%</option>
                                <option value="10">10%</option>
                            </Select>
                            <Field
                                label="วันหมดอายุ"
                                name="expiresAt"
                                type="date"
                                helper="เว้นว่าง = ใช้ได้จนถึงวันปิดรับสมัครของงาน"
                            />
                        </div>

                        <TextArea
                            label="บันทึกภายใน"
                            name="note"
                            rows={2}
                            maxLength={500}
                            placeholder="เช่น ตามสัญญาสปอนเซอร์ระดับ Gold — ผู้ประสานงาน คุณ..."
                        />

                        <Notice tone="sky" title="สิทธิ์ฟรีรับของที่งานเท่านั้น">
                            โค้ดที่ทำให้ค่าสมัครเป็น ฿0 จะบังคับรับของหน้างานอัตโนมัติ ไม่มีตัวเลือกส่งไปรษณีย์
                            และไม่ผ่านหน้าชำระเงิน — ได้ BIB ทันทีที่กดยืนยัน
                        </Notice>

                        <div className="flex gap-3">
                            <Button type="submit" disabled={pending}>
                                {pending ? <Spinner /> : "ออกโค้ด"}
                            </Button>
                            {codes.length > 0 && (
                                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                    ยกเลิก
                                </Button>
                            )}
                        </div>
                    </form>
                </Card>
            )}

            {[...groups.entries()].map(([groupName, list]) => {
                const groupIssued = list.reduce((s, c) => s + c.maxUses, 0)
                const groupUsed = list.reduce((s, c) => s + c.usedCount, 0)
                const people = registrations.filter((r) => list.some((c) => c.id === r.inviteCodeId))
                const allCodes = list.map((c) => c.code).join("\n")

                return (
                    <Card key={groupName} className="p-6 sm:p-8">
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                            <div>
                                <h3 className="font-semibold tracking-tight">{groupName}</h3>
                                <p className="text-[12px] text-ink-mute tnum mt-1">
                                    ใช้ไป {groupUsed} / {groupIssued} สิทธิ์ ·{" "}
                                    {discountLabel(list[0].discountPercent)} ·{" "}
                                    {list.length === 1 ? "โค้ดเดียวทั้งกลุ่ม" : `${list.length} ใบ ใบละ 1 สิทธิ์`}
                                    {list[0].expiresAt && ` · หมดอายุ ${formatDate(list[0].expiresAt)}`}
                                </p>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                                <a
                                    href={`/api/admin/invite-codes/export?event=${eventId}&group=${encodeURIComponent(groupName)}`}
                                    className="eyebrow text-ink-soft hover:text-ink transition-colors inline-flex items-center gap-1.5"
                                >
                                    <Download className="w-3.5 h-3.5" strokeWidth={2.2} />
                                    Excel
                                </a>
                                <button
                                    type="button"
                                    onClick={() => copy(allCodes, groupName)}
                                    className={cn(
                                        "eyebrow transition-colors inline-flex items-center gap-1.5",
                                        copied === groupName ? "text-lime" : "text-ink hover:text-ink-soft"
                                    )}
                                >
                                    {copied === groupName ? (
                                        <>
                                            <Check className="w-3.5 h-3.5" strokeWidth={2.6} />
                                            คัดลอกแล้ว
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3.5 h-3.5" strokeWidth={2.2} />
                                            คัดลอกโค้ด ({list.length})
                                        </>
                                    )}
                                </button>
                                {/* ลบทั้งกลุ่ม — ทางออกตอนออกโค้ดผิด (ชื่อผิด ส่วนลดผิด จำนวนผิด)
                                    จะได้ไม่ต้องกดลบทีละใบ 20 ครั้งก่อนสร้างใหม่ */}
                                {groupUsed < groupIssued && (
                                    <ConfirmAction
                                        action={deleteInviteCodeGroup.bind(null, eventId, groupName)}
                                        title={`ลบกลุ่ม "${groupName}" ทั้งหมด?`}
                                        message={
                                            groupUsed > 0
                                                ? `จะลบโค้ดที่ยังไม่มีใครใช้ ${list.filter((c) => c.usedCount === 0).length} ใบ ` +
                                                  `ส่วนอีก ${groupUsed} ใบที่มีคนใช้สิทธิ์ไปแล้วจะเก็บไว้ เพื่อให้ตามที่มาของที่นั่งได้`
                                                : `โค้ดทั้ง ${list.length} ใบของกลุ่มนี้จะถูกลบถาวร ยังไม่มีใครใช้สิทธิ์ จึงไม่กระทบผู้สมัคร`
                                        }
                                        confirmLabel="ลบทั้งกลุ่ม"
                                        className="eyebrow text-ink-mute hover:text-danger transition-colors"
                                    >
                                        ลบทั้งกลุ่ม
                                    </ConfirmAction>
                                )}
                            </div>
                        </div>

                        {/* แถบความคืบหน้า — ตอบคำถาม "เหลือกี่สิทธิ์" ได้โดยไม่ต้องอ่านตัวเลข */}
                        <div className="mt-4 h-1.5 rounded-full bg-paper-3 overflow-hidden">
                            <div
                                className="h-full bg-ink rounded-full transition-all"
                                style={{ width: `${groupIssued > 0 ? (groupUsed / groupIssued) * 100 : 0}%` }}
                            />
                        </div>

                        <ul className="mt-5 divide-y divide-line border-t border-line">
                            {list.map((c) => {
                                const full = c.usedCount >= c.maxUses
                                // คนที่ใช้โค้ดใบนี้ — โชว์ติดกับโค้ดเลย เพราะคำถามหน้างานคือ
                                // "โค้ดใบนี้ใครถือ" ไม่ใช่ "มีคนใช้แล้วกี่คน"
                                const users = people.filter((p) => p.inviteCodeId === c.id)
                                return (
                                    <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3">
                                        {/* ไอคอนคัดลอกอยู่ติดโค้ดเสมอ ไม่ได้โผล่ตอน hover — บนมือถือไม่มี hover
                                            และถ้าไม่มีอะไรบอก แอดมินจะลากเมาส์เลือกข้อความเอาเองซึ่งพลาดง่าย */}
                                        <button
                                            type="button"
                                            onClick={() => copy(c.code, c.id)}
                                            title="คัดลอกโค้ด"
                                            className={cn(
                                                "group inline-flex items-center gap-2 rounded-lg -mx-1 px-1 py-0.5 transition-colors",
                                                copied === c.id ? "text-lime" : "hover:text-ink-soft"
                                            )}
                                        >
                                            <span className="font-mono text-[15px] tracking-[0.15em]">{c.code}</span>
                                            {copied === c.id ? (
                                                <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={2.6} />
                                            ) : (
                                                <Copy
                                                    className="w-3.5 h-3.5 shrink-0 text-ink-mute group-hover:text-ink transition-colors"
                                                    strokeWidth={2}
                                                />
                                            )}
                                        </button>

                                        {!c.active ? (
                                            <Badge tone="neutral">ปิดใช้งาน</Badge>
                                        ) : full ? (
                                            <Badge tone="ink">ใช้ครบแล้ว</Badge>
                                        ) : (
                                            <Badge tone="lime">ใช้ได้</Badge>
                                        )}

                                        <span className="text-[12px] text-ink-mute tnum">
                                            {c.usedCount}/{c.maxUses}
                                        </span>

                                        {/* โค้ดใบละคนจะมีชื่อเดียว ส่วนโค้ดเดียวทั้งกลุ่มอาจมีหลายสิบชื่อ
                                            จึงตัดที่ 3 ชื่อ ที่เหลือดูได้ในรายชื่อเต็มด้านล่าง */}
                                        {users.length > 0 && (
                                            <span className="text-[13px] tracking-tight min-w-0">
                                                {users.slice(0, 3).map((u, i) => (
                                                    <span key={u.id}>
                                                        {i > 0 && <span className="text-ink-mute">, </span>}
                                                        {u.bib && <span className="numeral tnum text-ink-mute mr-1">{u.bib}</span>}
                                                        {u.fullName || u.email || "—"}
                                                        {u.phone && (
                                                            <span className="text-[11px] text-ink-mute tnum ml-1.5">{u.phone}</span>
                                                        )}
                                                    </span>
                                                ))}
                                                {users.length > 3 && (
                                                    <span className="text-[12px] text-ink-mute"> +{users.length - 3} คน</span>
                                                )}
                                            </span>
                                        )}

                                        <div className="ml-auto flex items-center gap-3 shrink-0">
                                            {c.maxUses > 1 && (
                                                <input
                                                    type="number"
                                                    min={c.usedCount || 1}
                                                    max={500}
                                                    defaultValue={c.maxUses}
                                                    disabled={pending}
                                                    onBlur={(e) => {
                                                        const next = Number(e.target.value)
                                                        if (next !== c.maxUses) {
                                                            run(() => updateInviteCodeQuota(c.id, next))
                                                        }
                                                    }}
                                                    className={`${inputClass} h-8 w-16 text-center tnum`}
                                                    aria-label="จำนวนสิทธิ์"
                                                />
                                            )}
                                            <button
                                                type="button"
                                                disabled={pending}
                                                onClick={() => run(() => toggleInviteCode(c.id, !c.active))}
                                                className="eyebrow text-ink-mute hover:text-ink transition-colors"
                                            >
                                                {c.active ? "ปิด" : "เปิด"}
                                            </button>
                                            {c.usedCount === 0 && (
                                                <ConfirmAction
                                                    action={deleteInviteCode.bind(null, c.id)}
                                                    title="ลบโค้ดนี้?"
                                                    message={`โค้ด ${c.code} จะถูกลบถาวร`}
                                                    confirmLabel="ลบโค้ด"
                                                    className="eyebrow text-ink-mute hover:text-danger transition-colors"
                                                >
                                                    ลบ
                                                </ConfirmAction>
                                            )}
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>

                        {people.length > 0 && (
                            <div className="mt-5">
                                <button
                                    type="button"
                                    onClick={() => setExpanded(expanded === groupName ? null : groupName)}
                                    className="eyebrow text-ink-soft hover:text-ink transition-colors"
                                >
                                    {expanded === groupName ? "ซ่อนรายชื่อ" : `ดูรายชื่อที่ใช้สิทธิ์แล้ว (${people.length})`}
                                </button>

                                {expanded === groupName && (
                                    <ul className="mt-3 divide-y divide-line border-t border-line">
                                        {people.map((p) => (
                                            <li key={p.id} className="py-2.5">
                                                <p className="text-[13px] tracking-tight">
                                                    {p.bib && <span className="numeral tnum mr-2">{p.bib}</span>}
                                                    {p.fullName ?? p.email ?? "—"}
                                                    {p.phone && (
                                                        <span className="text-[11px] text-ink-mute tnum ml-2">{p.phone}</span>
                                                    )}
                                                </p>
                                                <p className="text-[11px] text-ink-mute tnum mt-0.5">
                                                    {p.categoryName && `${p.categoryName} · `}
                                                    {p.shirtSize && `ไซส์ ${p.shirtSize} · `}
                                                    {formatDate(p.registeredAt)}
                                                    {p.email && ` · ${p.email}`}
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </Card>
                )
            })}
        </section>
    )
}

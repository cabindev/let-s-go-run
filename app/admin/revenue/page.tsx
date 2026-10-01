import Link from "next/link"
import { requireAdminPage } from "@/lib/auth-helpers"
import { getRevenueReport } from "@/lib/revenue"
import { getPayoutSummary, type PayoutSummary } from "@/lib/payouts"
import { Card } from "@/components/ui/Card"
import { Badge, Notice, type Tone } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { formatBaht, formatDate, formatNumber } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: "รายได้ · RunLudtong" }

export default async function AdminRevenuePage() {
    await requireAdminPage()
    // Stripe ล่มหรือคีย์ผิดต้องไม่ทำให้รายงานรายได้ทั้งหน้าพัง — แสดงข้อความแทนเฉพาะส่วนนี้
    const [r, payouts] = await Promise.all([
        getRevenueReport(),
        getPayoutSummary().catch((err: unknown) => {
            console.error("[revenue] โหลดข้อมูลการโอนเงินจาก Stripe ไม่สำเร็จ", err)
            return null
        }),
    ])

    return (
        <div className="space-y-10">
            <div>
                <p className="eyebrow">นับเฉพาะรายการที่ชำระเงินแล้ว</p>
                <h1 className="display text-3xl sm:text-4xl mt-2">รายได้</h1>
            </div>

            {/* ยอดรวม — แยกสามก้อนให้เห็นตั้งแต่บรรทัดแรกว่าเงินมาจากไหน */}
            <section className="grid gap-4 sm:grid-cols-3">
                <Card className="raise p-5">
                    <p className="eyebrow">ค่าสมัคร</p>
                    <p className="numeral text-2xl sm:text-3xl mt-1.5">{formatBaht(r.entryTotal)}</p>
                    <p className="text-[12px] text-ink-mute mt-1 tnum">{r.events.length} งาน</p>
                </Card>
                <Card className="raise p-5">
                    <p className="eyebrow">ขายสินค้า</p>
                    <p className="numeral text-2xl sm:text-3xl mt-1.5">{formatBaht(r.productTotal)}</p>
                    <p className="text-[12px] text-ink-mute mt-1 tnum">{r.products.length} รายการ</p>
                </Card>
                <Card className="raise p-5 bg-paper-2">
                    <p className="eyebrow">ค่าจัดส่งที่เก็บมา</p>
                    <p className="numeral text-2xl sm:text-3xl mt-1.5 text-ink-soft">{formatBaht(r.shippingTotal)}</p>
                    <p className="text-[12px] text-ink-mute mt-1">ไม่ใช่รายได้ — จ่ายไปรษณีย์ต่อ</p>
                </Card>
            </section>

            {r.estimatedRegistrations > 0 && (
                <Notice tone="move" title="มีตัวเลขบางส่วนเป็นการประมาณ">
                    ใบสมัคร {formatNumber(r.estimatedRegistrations)} ใบชำระเงินก่อนระบบเริ่มบันทึกยอดจริง
                    จึงคำนวณย้อนหลังจากราคาปัจจุบันให้ — ถ้าเคยแก้ราคาประเภทหลังจากนั้น ตัวเลขจะคลาดเคลื่อน
                    ส่วนใบที่จ่ายหลังจากนี้จะใช้ยอดที่บันทึกไว้จริงเสมอ
                </Notice>
            )}

            {/* ───── ค่าสมัคร แยกตามงาน ───── */}
            <section className="space-y-4">
                <h2 className="display text-lg">ค่าสมัคร · แยกตามงาน</h2>

                {r.events.length === 0 ? (
                    <Card className="raise">
                        <EmptyState title="ยังไม่มีรายได้จากค่าสมัคร" description="เมื่อมีผู้สมัครชำระเงินแล้วจะแสดงที่นี่" />
                    </Card>
                ) : (
                    r.events.map((e) => (
                        <Card key={e.eventId} className="raise overflow-hidden">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 sm:px-6 py-4 border-b border-line">
                                <div className="min-w-0">
                                    <Link
                                        href={`/admin/registrations?event=${e.eventId}`}
                                        className="font-semibold tracking-tight hover:text-ink-soft transition-colors"
                                    >
                                        {e.title}
                                    </Link>
                                    <p className="text-[12px] text-ink-mute mt-0.5 tnum">{formatDate(e.date)}</p>
                                </div>
                                <p className="numeral text-xl shrink-0">{formatBaht(e.entryTotal)}</p>
                            </div>

                            <dl className="divide-y divide-line">
                                <Row
                                    label="ผู้สมัครทั่วไป"
                                    note={`${formatNumber(e.regularCount)} คน`}
                                    value={formatBaht(e.regularEntry)}
                                />
                                {e.discountedCount > 0 && (
                                    <Row
                                        label="ผู้ถือโค้ด (จ่ายบางส่วน)"
                                        note={`${formatNumber(e.discountedCount)} คน`}
                                        value={formatBaht(e.discountedEntry)}
                                    />
                                )}
                                {e.freeCount > 0 && (
                                    <Row
                                        label="ผู้ถือโค้ด (ไม่มีค่าสมัคร)"
                                        note={`${formatNumber(e.freeCount)} คน`}
                                        value={formatBaht(0)}
                                        muted
                                    />
                                )}
                                {e.shipping > 0 && (
                                    <Row
                                        label="ค่าจัดส่งที่เก็บมา"
                                        note="ไม่ใช่รายได้"
                                        value={formatBaht(e.shipping)}
                                        muted
                                    />
                                )}
                            </dl>

                            {/* มูลค่าสิทธิ์ที่ยกให้ไป — ไม่บวกเข้ารายได้ แต่เป็นตัวเลขที่สปอนเซอร์ขอ */}
                            {e.grantedValue > 0 && (
                                <div className="border-t border-line bg-paper-2 px-5 sm:px-6 py-4">
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                        <p className="text-[13px] font-semibold tracking-tight">
                                            มูลค่าสิทธิ์ที่ให้ไป
                                            <span className="font-normal text-ink-mute"> · ไม่ใช่รายได้</span>
                                        </p>
                                        <p className="numeral text-base tnum">{formatBaht(e.grantedValue)}</p>
                                    </div>
                                    <ul className="mt-2.5 space-y-1.5">
                                        {e.grantedByGroup.map((g) => (
                                            <li key={g.groupName} className="flex items-baseline justify-between gap-4 text-[13px]">
                                                <span className="text-ink-soft truncate">{g.groupName}</span>
                                                <span className="shrink-0 tnum text-ink-mute">
                                                    {formatNumber(g.count)} สิทธิ์ · {formatBaht(g.value)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </Card>
                    ))
                )}
            </section>

            {/* ───── ร้านค้า แยกตามสินค้า ───── */}
            <section className="space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 className="display text-lg">ขายสินค้า · แยกตามรหัสสินค้า</h2>
                    <p className="text-[13px] text-ink-mute">สินค้าขายได้ตลอด ไม่ผูกกับงานใดงานหนึ่ง</p>
                </div>

                {r.products.length === 0 ? (
                    <Card className="raise">
                        <EmptyState title="ยังไม่มียอดขายสินค้า" description="เมื่อมีออเดอร์ที่ชำระเงินแล้วจะแสดงที่นี่" />
                    </Card>
                ) : (
                    <Card className="raise overflow-hidden">
                        <ul className="divide-y divide-line">
                            {r.products.map((p) => (
                                <li key={p.key} className="px-5 sm:px-6 py-4">
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                        <div className="min-w-0 flex items-center gap-2">
                                            <span className="font-semibold tracking-tight truncate">{p.name}</span>
                                            {!p.slug && <Badge tone="outline">ไม่มีรหัส</Badge>}
                                        </div>
                                        <p className="shrink-0 tnum">
                                            <span className="text-[13px] text-ink-mute">{formatNumber(p.quantity)} ชิ้น · </span>
                                            <span className="numeral text-base">{formatBaht(p.revenue)}</span>
                                        </p>
                                    </div>
                                    {/* แยกรายไซส์ — ใช้วางแผนสั่งผลิตรอบหน้าได้ */}
                                    <p className="text-[12px] text-ink-mute mt-1.5 tnum">
                                        {p.variants.map((v) => `${v.name} ${v.quantity}`).join(" · ")}
                                    </p>
                                </li>
                            ))}
                        </ul>
                        <div className="border-t border-line bg-paper-2 px-5 sm:px-6 py-4 flex items-baseline justify-between gap-4">
                            <span className="eyebrow">รวมยอดขายสินค้า</span>
                            <span className="numeral text-xl">{formatBaht(r.productTotal)}</span>
                        </div>
                    </Card>
                )}
            </section>

            <PayoutSection payouts={payouts} />
        </div>
    )
}

const PAYOUT_STATUS: Record<string, { label: string; tone: Tone }> = {
    paid: { label: "เข้าบัญชีแล้ว", tone: "lime" },
    in_transit: { label: "กำลังโอน", tone: "sky" },
    pending: { label: "รอโอน", tone: "ink" },
    failed: { label: "โอนไม่สำเร็จ", tone: "danger" },
    canceled: { label: "ยกเลิก", tone: "outline" },
}

function PayoutSection({ payouts }: { payouts: PayoutSummary | null }) {
    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="display text-lg">เงินเข้าบัญชีธนาคาร</h2>
                <p className="text-[13px] text-ink-mute">ดึงสดจาก Stripe · หักค่าธรรมเนียมแล้ว จึงน้อยกว่ายอดด้านบน</p>
            </div>

            {!payouts ? (
                <Notice tone="danger" title="โหลดข้อมูลจาก Stripe ไม่ได้">
                    ตัวเลขรายได้ด้านบนยังถูกต้อง แต่ตอนนี้ดูสถานะการโอนเงินไม่ได้ ลองรีเฟรชอีกครั้ง
                    หรือตรวจสอบที่ Stripe Dashboard
                </Notice>
            ) : (
                <>
                    {payouts.testMode && (
                        <Notice tone="move" title="กำลังใช้คีย์ทดสอบของ Stripe">
                            ตัวเลขส่วนนี้มาจากโหมดทดสอบ ไม่ใช่เงินจริง — บนเซิร์ฟเวอร์จริงจะแสดงยอดโอนจริง
                        </Notice>
                    )}

                    <div className="grid gap-4 sm:grid-cols-3">
                        <Card className="raise p-5">
                            <p className="eyebrow">โอนเข้าบัญชีแล้ว</p>
                            <p className="numeral text-2xl sm:text-3xl mt-1.5">{formatBaht(payouts.paidTotal)}</p>
                            <p className="text-[12px] text-ink-mute mt-1 tnum">
                                จาก {formatNumber(payouts.payouts.length)} รายการล่าสุด
                            </p>
                        </Card>
                        <Card className="raise p-5">
                            <p className="eyebrow">พร้อมโอน</p>
                            <p className="numeral text-2xl sm:text-3xl mt-1.5">{formatBaht(payouts.available)}</p>
                            <p className="text-[12px] text-ink-mute mt-1">รอรอบโอนอัตโนมัติถัดไป</p>
                        </Card>
                        <Card className="raise p-5 bg-paper-2">
                            <p className="eyebrow">กำลังเข้ามา</p>
                            <p className="numeral text-2xl sm:text-3xl mt-1.5 text-ink-soft">{formatBaht(payouts.incoming)}</p>
                            <p className="text-[12px] text-ink-mute mt-1">ลูกค้าจ่ายแล้ว Stripe ยังกันไว้</p>
                        </Card>
                    </div>

                    {payouts.payouts.length === 0 ? (
                        <Card className="raise">
                            <EmptyState title="ยังไม่มีการโอนเงิน" description="เมื่อ Stripe โอนเงินเข้าบัญชีธนาคารจะแสดงที่นี่" />
                        </Card>
                    ) : (
                        <Card className="raise overflow-hidden">
                            <ul className="divide-y divide-line">
                                {payouts.payouts.map((p) => {
                                    const s = PAYOUT_STATUS[p.status] ?? { label: p.status, tone: "neutral" as Tone }
                                    return (
                                        <li key={p.id} className="px-5 sm:px-6 py-4">
                                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                                <div className="min-w-0 flex items-center gap-2">
                                                    <span className="font-semibold tracking-tight tnum">{formatDate(p.arrivalDate)}</span>
                                                    <Badge tone={s.tone}>{s.label}</Badge>
                                                </div>
                                                <p className="numeral text-base shrink-0">{formatBaht(p.amount)}</p>
                                            </div>
                                            <p className="text-[12px] text-ink-mute mt-1 tnum">
                                                {[p.bankName, p.last4 && `บัญชี ••••${p.last4}`].filter(Boolean).join(" · ") || "บัญชีธนาคาร"}
                                            </p>
                                            {p.failureMessage && <p className="text-[12px] text-danger mt-1">{p.failureMessage}</p>}
                                        </li>
                                    )
                                })}
                            </ul>
                        </Card>
                    )}
                </>
            )}
        </section>
    )
}

function Row({ label, note, value, muted }: { label: string; note?: string; value: string; muted?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-4 px-5 sm:px-6 py-3">
            <dt className="text-[14px] min-w-0">
                <span className={muted ? "text-ink-mute" : "text-ink-soft"}>{label}</span>
                {note && <span className="text-[12px] text-ink-mute tnum"> · {note}</span>}
            </dt>
            <dd className={`text-[15px] font-semibold tnum shrink-0 ${muted ? "text-ink-mute" : ""}`}>{value}</dd>
        </div>
    )
}

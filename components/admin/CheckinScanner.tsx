'use client'

import { useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/Card"
import { Button, Spinner } from "@/components/ui/Button"
import { Notice, Badge } from "@/components/ui/Badge"
import { confirmPickupGroup, lookupCheckinByNationalId, lookupCheckinByPhone, lookupRegistrationForCheckin, type CheckinInfo } from "@/app/actions/admin"
import { cn, formatDate, formatTime } from "@/lib/utils"

const READER_ID = "checkin-qr-reader"

type Source = "qr" | "phone" | "nationalId"

type Mode = "scan" | "review" | "signature" | "success"

const PICKUP_LABEL: Record<string, string> = {
    PENDING: "ยังไม่รับ",
    PICKED_UP: "รับที่บูธแล้ว",
    SHIPPED: "ส่งไปรษณีย์แล้ว",
}

export function CheckinScanner() {
    const [mode, setMode] = useState<Mode>("scan")
    // ผลค้นหา — QR ได้ 1 ใบเสมอ, เบอร์โทรอาจได้หลายใบ (คนเดียวสมัครให้ทั้งกลุ่ม)
    const [results, setResults] = useState<CheckinInfo[]>([])
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [source, setSource] = useState<Source>("qr")
    const [phone, setPhone] = useState("")
    const [nationalId, setNationalId] = useState("")
    const [pickupByName, setPickupByName] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [pending, setPending] = useState(false)
    const [cameraError, setCameraError] = useState<string | null>(null)
    const [cameraReady, setCameraReady] = useState(false)
    const [successSignature, setSuccessSignature] = useState<string | null>(null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scannerRef = useRef<any>(null)
    const lastScannedRef = useRef<string | null>(null)
    const lockRef = useRef(false) // กันสแกนซ้อนระหว่างรอผล lookup

    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const drawingRef = useRef(false)
    const hasSignatureRef = useRef(false)

    // ── เปิดกล้องสแกน QR ครั้งเดียวตอนโหลดหน้า แล้วปล่อยให้ทำงานตลอด ──
    // (ซ่อนด้วย CSS เวลาไม่ได้อยู่โหมด scan แทนการ unmount กันต้องขอสิทธิ์กล้องใหม่ทุกรอบ)
    useEffect(() => {
        let cancelled = false
        // รอ start() ให้เสร็จก่อนค่อยอนุญาตให้ stop() ทำงาน — กัน unmount เร็วเกินไป
        // (เช่นเปลี่ยนเมนูระหว่างกล้องกำลังเปิด) แล้วไปเรียก stop() ซ้อนกับ start()
        // ที่ยังไม่ resolve ซึ่งทำให้ html5-qrcode ปล่อยกล้องไม่หมด จน browser ค้าง/แครช
        let startPromise: Promise<unknown> | null = null

        import("html5-qrcode").then(({ Html5Qrcode }) => {
            if (cancelled) return
            const qr = new Html5Qrcode(READER_ID)
            scannerRef.current = qr

            startPromise = qr.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: 250 },
                (decodedText: string) => {
                    if (lockRef.current || decodedText === lastScannedRef.current) return
                    lastScannedRef.current = decodedText
                    void handleScan(decodedText)
                },
                () => { /* ไม่เจอ QR ในเฟรมนี้ — ปกติ ไม่ต้องทำอะไร */ }
            ).then(() => {
                if (!cancelled) setCameraReady(true)
            }).catch((e: unknown) => {
                if (!cancelled) {
                    setCameraError(e instanceof Error ? e.message : "เปิดกล้องไม่ได้ — เช็คว่าอนุญาตให้เว็บนี้ใช้กล้องหรือยัง")
                }
            })
        })

        return () => {
            cancelled = true
            // start() อาจยังไม่เสร็จตอนนี้ — รอให้จบ (สำเร็จหรือพัง) ก่อนค่อยสั่งปิดกล้องจริง
            Promise.resolve(startPromise)
                .catch(() => {})
                .then(() => scannerRef.current?.stop?.().catch(() => {}))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    async function handleScan(registrationId: string) {
        lockRef.current = true
        setError(null)
        const res = await lookupRegistrationForCheckin(registrationId)
        lockRef.current = false
        if (!res.ok) {
            setError(res.error)
            setTimeout(() => { lastScannedRef.current = null }, 1500)
            return
        }
        showResults([res.data], "qr")
    }

    async function search(e: React.FormEvent, from: "phone" | "nationalId") {
        e.preventDefault()
        if (pending) return
        setPending(true)
        setError(null)
        const res = from === "phone" ? await lookupCheckinByPhone(phone) : await lookupCheckinByNationalId(nationalId)
        setPending(false)
        if (!res.ok) return setError(res.error)
        showResults(res.data, from)
    }

    function showResults(list: CheckinInfo[], from: Source) {
        setResults(list)
        setSource(from)
        // เลือกไว้ก่อนเฉพาะคนที่ยังไม่รับ — กันเผลอยืนยันซ้ำคนที่รับไปแล้ว
        const pendingIds = list.filter((r) => r.pickupStatus === "PENDING").map((r) => r.id)
        setSelected(new Set(pendingIds.length > 0 || list.length !== 1 ? pendingIds : [list[0].id]))
        setMode("review")
    }

    function toggle(id: string) {
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    /** กลับไปสแกนคนถัดไป */
    function scanNext() {
        setResults([])
        setSelected(new Set())
        setPhone("")
        setNationalId("")
        setPickupByName("")
        setMode("scan")
        setError(null)
        setSuccessSignature(null)
        lastScannedRef.current = null
    }

    function goToSignature() {
        if (selected.size === 0) return setError("เลือกผู้สมัครอย่างน้อย 1 คน")
        setError(null)
        // เดาชื่อผู้รับเป็นคนแรกที่เลือกไว้ — ถ้ามีคนอื่นมารับแทน เจ้าหน้าที่แก้ชื่อได้
        if (!pickupByName) setPickupByName(results.find((r) => selected.has(r.id))?.fullName ?? "")
        setMode("signature")
        hasSignatureRef.current = false
        requestAnimationFrame(() => {
            const canvas = canvasRef.current
            const ctx = canvas?.getContext("2d")
            if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
        })
    }

    function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
        const rect = e.currentTarget.getBoundingClientRect()
        return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
        drawingRef.current = true
        hasSignatureRef.current = true
        const ctx = canvasRef.current?.getContext("2d")
        const { x, y } = pointerPos(e)
        ctx?.beginPath()
        ctx?.moveTo(x, y)
    }

    function draw(e: React.PointerEvent<HTMLCanvasElement>) {
        if (!drawingRef.current) return
        const ctx = canvasRef.current?.getContext("2d")
        if (!ctx) return
        const { x, y } = pointerPos(e)
        ctx.lineWidth = 3
        ctx.lineCap = "round"
        ctx.strokeStyle = "#111"
        ctx.lineTo(x, y)
        ctx.stroke()
    }

    function endDraw() {
        drawingRef.current = false
    }

    function clearSignature() {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext("2d")
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
        hasSignatureRef.current = false
    }

    async function submitPickedUp() {
        if (selected.size === 0) return
        if (!pickupByName.trim()) return setError("กรอกชื่อคนที่มารับ")
        if (!hasSignatureRef.current) return setError("กรุณาให้ผู้รับเซ็นด้วยนิ้วก่อนยืนยัน")
        setPending(true)
        setError(null)

        const canvas = canvasRef.current!
        const signatureDataUrl = canvas.toDataURL("image/png")
        const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"))

        const fd = new FormData()
        for (const id of selected) fd.append("registrationIds", id)
        fd.set("pickupByName", pickupByName.trim())
        if (blob) fd.set("signature", new File([blob], "signature.png", { type: "image/png" }))

        const res = await confirmPickupGroup(fd)
        setPending(false)
        if (!res.ok) return setError(res.error)

        setResults(res.data)
        setSuccessSignature(signatureDataUrl)
        setMode("success")
    }

    return (
        <div className="space-y-5">
            {error && <Notice tone="danger">{error}</Notice>}
            {cameraError && <Notice tone="danger" title="เปิดกล้องไม่ได้">{cameraError}</Notice>}

            {/* กล้องคงอยู่ตลอดตั้งแต่โหลดหน้า — ซ่อนด้วย CSS เฉพาะตอนไม่ใช่โหมด scan กันต้องขอสิทธิ์กล้องใหม่ทุกครั้ง */}
            <Card className={cn("p-4 space-y-3", mode !== "scan" && "hidden")}>
                <p className="eyebrow">กล้องสแกน</p>
                <div className="relative rounded-2xl overflow-hidden bg-black min-h-[280px]">
                    <div id={READER_ID} className="w-full h-full" />
                    {!cameraReady && !cameraError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 text-paper">
                            <Spinner />
                            <p className="text-[12px]">กำลังเปิดกล้อง...</p>
                        </div>
                    )}
                </div>
                <p className="text-[12px] text-ink-mute text-center">ยื่น QR ให้อยู่ในกรอบกล้อง</p>
            </Card>

            {/* ทางเลือกสำหรับคนที่ไม่มี QR (เช่นข้อมูลอิมพอร์ตจากชีท ไม่มีบัญชีให้ล็อกอิน) */}
            <Card className={cn("p-4 space-y-3", mode !== "scan" && "hidden")}>
                <p className="eyebrow">หรือค้นด้วยเบอร์โทร</p>
                <form onSubmit={(e) => search(e, "phone")} className="flex gap-3">
                    <input
                        type="tel"
                        inputMode="numeric"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="08x-xxx-xxxx"
                        className="flex-1 min-w-0 h-11 px-3 rounded-xl border border-line text-[15px] bg-transparent focus:outline-none focus:border-ink"
                    />
                    <Button type="submit" disabled={pending || !phone.trim()}>
                        {pending ? <Spinner /> : "ค้นหา"}
                    </Button>
                </form>
            </Card>

            <Card className={cn("p-4 space-y-3", mode !== "scan" && "hidden")}>
                <p className="eyebrow">หรือค้นด้วยเลขบัตรประชาชน</p>
                <form onSubmit={(e) => search(e, "nationalId")} className="flex gap-3">
                    <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={nationalId}
                        onChange={(e) => setNationalId(e.target.value)}
                        placeholder="13 หลัก"
                        className="flex-1 min-w-0 h-11 px-3 rounded-xl border border-line text-[15px] bg-transparent focus:outline-none focus:border-ink"
                    />
                    <Button type="submit" disabled={pending || !nationalId.trim()}>
                        {pending ? <Spinner /> : "ค้นหา"}
                    </Button>
                </form>
            </Card>

            {mode === "review" && results.length > 0 && (
                <Card className="p-5 sm:p-6 space-y-5">
                    <div>
                        <p className="eyebrow">
                            {source === "phone" ? `เบอร์ ${phone} · ${results.length} ใบสมัคร`
                                : source === "nationalId" ? `บัตร ${nationalId} · ${results.length} ใบสมัคร`
                                : "ผู้สมัคร"}
                        </p>
                        <p className="text-sm text-ink-soft mt-1">เลือกคนที่จะรับของรอบนี้</p>
                    </div>

                    {source === "phone" && (
                        <Notice tone="sky">ถามชื่อผู้สมัครและเทียบเลขบัตรกับบัตรจริงก่อนส่งของ</Notice>
                    )}

                    <div className="space-y-2">
                        {results.map((r) => (
                            <label
                                key={r.id}
                                className={cn(
                                    "flex items-start gap-3 px-4 py-3 rounded-2xl border cursor-pointer transition-colors",
                                    selected.has(r.id) ? "border-ink bg-paper-2" : "border-line"
                                )}
                            >
                                <input
                                    type="checkbox"
                                    checked={selected.has(r.id)}
                                    onChange={() => toggle(r.id)}
                                    className="mt-1"
                                />
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="font-medium tracking-tight">{r.fullName || "-"}</p>
                                        <Badge tone={r.pickupStatus === "PICKED_UP" ? "lime" : r.pickupStatus === "SHIPPED" ? "sky" : "outline"}>
                                            {PICKUP_LABEL[r.pickupStatus] ?? r.pickupStatus}
                                        </Badge>
                                    </div>
                                    <p className="text-[13px] text-ink-soft">
                                        BIB {r.bib || "-"} · ไซส์ {r.shirtSize || "-"}
                                    </p>
                                    <p className="text-[13px] text-ink-soft tnum">
                                        บัตร {r.nationalId || "ไม่มีข้อมูล"}{r.phone && ` · โทร ${r.phone}`}
                                    </p>
                                    <p className="text-[12px] text-ink-mute">
                                        {r.eventTitle}{r.categoryName && ` · ${r.categoryName}`}
                                    </p>
                                    {r.pickupAt && r.pickupStatus !== "PENDING" && (
                                        <p className="text-[12px] text-ink-mute">
                                            บันทึกเมื่อ {formatDate(r.pickupAt)} {formatTime(r.pickupAt)}
                                            {r.pickupByName && ` · ${r.pickupByName} รับ`}
                                            {r.shippingTrackingNo && ` · พัสดุ ${r.shippingTrackingNo}`}
                                        </p>
                                    )}
                                </div>
                            </label>
                        ))}
                    </div>

                    {results.some((r) => selected.has(r.id) && r.pickupStatus !== "PENDING") && (
                        <Notice tone="sky">มีรายการที่ยืนยันไปแล้วถูกเลือกอยู่ — จะบันทึกทับด้วยลายเซ็นใหม่</Notice>
                    )}

                    <Button onClick={goToSignature} disabled={pending || selected.size === 0} className="w-full">
                        ยืนยันรับที่บูธ ({selected.size} คน)
                    </Button>

                    <Button variant="ghost" size="sm" onClick={scanNext} className="w-full" disabled={pending}>
                        ยกเลิก / ค้นหาใหม่
                    </Button>
                </Card>
            )}

            {mode === "signature" && selected.size > 0 && (
                <Card className="p-5 sm:p-6 space-y-4">
                    <div>
                        <p className="eyebrow">ยืนยันรับที่บูธ · {selected.size} คน</p>
                        <ul className="text-sm text-ink-soft mt-1 space-y-0.5">
                            {results.filter((r) => selected.has(r.id)).map((r) => (
                                <li key={r.id}>{r.fullName || "-"} · BIB {r.bib || "-"}</li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <label htmlFor="pickupByName" className="text-[12px] text-ink-mute mb-2 block">ชื่อคนที่มารับ</label>
                        <input
                            id="pickupByName"
                            value={pickupByName}
                            onChange={(e) => setPickupByName(e.target.value)}
                            className="w-full h-11 px-3 rounded-xl border border-line text-[15px] bg-transparent focus:outline-none focus:border-ink"
                        />
                    </div>

                    <div>
                        <p className="text-[12px] text-ink-mute mb-2">ให้ผู้รับเซ็นด้วยนิ้วในกรอบด้านล่าง เป็นหลักฐานการรับของ</p>
                        <canvas
                            ref={canvasRef}
                            width={600}
                            height={220}
                            className="w-full h-[220px] rounded-2xl border border-line bg-white touch-none"
                            onPointerDown={startDraw}
                            onPointerMove={draw}
                            onPointerUp={endDraw}
                            onPointerLeave={endDraw}
                        />
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" onClick={clearSignature} disabled={pending} className="flex-1">
                            ล้างลายเซ็น
                        </Button>
                        <Button onClick={submitPickedUp} disabled={pending} className="flex-1">
                            {pending ? <Spinner /> : "ยืนยันรับของ"}
                        </Button>
                    </div>

                    <Button variant="ghost" size="sm" onClick={() => setMode("review")} className="w-full" disabled={pending}>
                        ย้อนกลับ
                    </Button>
                </Card>
            )}

            {mode === "success" && results.length > 0 && (
                <Card className="p-5 sm:p-6 space-y-5">
                    <Notice tone="lime" title="บันทึกสำเร็จ">
                        {results[0].pickupByName} รับของ {results.length} ใบ
                        {results[0].pickupAt && ` · ${formatDate(results[0].pickupAt)} ${formatTime(results[0].pickupAt)}`}
                    </Notice>

                    <ul className="text-sm space-y-1">
                        {results.map((r) => (
                            <li key={r.id} className="flex justify-between gap-3">
                                <span>{r.fullName || "-"}</span>
                                <span className="text-ink-mute">BIB {r.bib || "-"}</span>
                            </li>
                        ))}
                    </ul>

                    {successSignature && (
                        <div>
                            <p className="eyebrow mb-2">ลายเซ็นผู้รับ</p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={successSignature} alt="ลายเซ็นผู้รับ" className="w-full rounded-2xl border border-line bg-white" />
                        </div>
                    )}

                    <Button onClick={scanNext} className="w-full">
                        สแกนต่อ
                    </Button>
                </Card>
            )}
        </div>
    )
}

'use client'

import { useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/Card"
import { Button, Spinner } from "@/components/ui/Button"
import { Notice, Badge } from "@/components/ui/Badge"
import { confirmPickupAdmin, lookupRegistrationForCheckin, type CheckinInfo } from "@/app/actions/admin"
import { cn, formatDate, formatTime } from "@/lib/utils"

const READER_ID = "checkin-qr-reader"

type Mode = "scan" | "review" | "signature" | "success"

const PICKUP_LABEL: Record<string, string> = {
    PENDING: "ยังไม่รับ",
    PICKED_UP: "รับที่บูธแล้ว",
    SHIPPED: "ส่งไปรษณีย์แล้ว",
}

export function CheckinScanner() {
    const [mode, setMode] = useState<Mode>("scan")
    const [data, setData] = useState<CheckinInfo | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [pending, setPending] = useState(false)
    const [cameraError, setCameraError] = useState<string | null>(null)
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

        import("html5-qrcode").then(({ Html5Qrcode }) => {
            if (cancelled) return
            const qr = new Html5Qrcode(READER_ID)
            scannerRef.current = qr

            qr.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: 250 },
                (decodedText: string) => {
                    if (lockRef.current || decodedText === lastScannedRef.current) return
                    lastScannedRef.current = decodedText
                    void handleScan(decodedText)
                },
                () => { /* ไม่เจอ QR ในเฟรมนี้ — ปกติ ไม่ต้องทำอะไร */ }
            ).catch((e: unknown) => {
                setCameraError(e instanceof Error ? e.message : "เปิดกล้องไม่ได้ — เช็คว่าอนุญาตให้เว็บนี้ใช้กล้องหรือยัง")
            })
        })

        return () => {
            cancelled = true
            scannerRef.current?.stop?.().catch(() => {})
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
        setData(res.data)
        setMode("review")
    }

    /** กลับไปสแกนคนถัดไป */
    function scanNext() {
        setData(null)
        setMode("scan")
        setError(null)
        setSuccessSignature(null)
        lastScannedRef.current = null
    }

    function goToSignature() {
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
        if (!data) return
        if (!hasSignatureRef.current) return setError("กรุณาให้ผู้สมัครเซ็นด้วยนิ้วก่อนยืนยัน")
        setPending(true)
        setError(null)

        const canvas = canvasRef.current!
        const signatureDataUrl = canvas.toDataURL("image/png")
        const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"))

        const fd = new FormData()
        fd.set("registrationId", data.id)
        fd.set("method", "PICKED_UP")
        if (blob) fd.set("signature", new File([blob], "signature.png", { type: "image/png" }))

        const res = await confirmPickupAdmin(fd)
        setPending(false)
        if (!res.ok) return setError(res.error)

        setData(res.data)
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
                <div id={READER_ID} className="rounded-2xl overflow-hidden bg-black min-h-[280px]" />
                <p className="text-[12px] text-ink-mute text-center">ยื่น QR ให้อยู่ในกรอบกล้อง</p>
            </Card>

            {data && mode === "review" && (
                <Card className="p-5 sm:p-6 space-y-5">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="eyebrow">ผู้สมัคร</p>
                            <h2 className="display text-xl mt-1">{data.fullName || "-"}</h2>
                        </div>
                        <Badge tone={data.pickupStatus === "PICKED_UP" ? "lime" : data.pickupStatus === "SHIPPED" ? "sky" : "outline"}>
                            {PICKUP_LABEL[data.pickupStatus] ?? data.pickupStatus}
                        </Badge>
                    </div>

                    <dl className="grid grid-cols-2 gap-4 text-sm">
                        <Field label="BIB" value={data.bib || "-"} />
                        <Field label="ไซส์เสื้อ" value={data.shirtSize || "-"} />
                        <Field label="งาน" value={data.eventTitle} className="col-span-2" />
                        <Field label="ประเภท" value={data.categoryName || "-"} className="col-span-2" />
                        {data.pickupAt && (
                            <Field
                                label="เวลาที่บันทึกล่าสุด"
                                value={`${formatDate(data.pickupAt)} ${formatTime(data.pickupAt)}`}
                                className="col-span-2"
                            />
                        )}
                        {data.shippingTrackingNo && <Field label="เลขพัสดุ" value={data.shippingTrackingNo} className="col-span-2" />}
                    </dl>

                    {data.pickupStatus !== "PENDING" && (
                        <Notice tone="sky">รายการนี้ยืนยันไปแล้ว — ยืนยันซ้ำได้ถ้าจำเป็น</Notice>
                    )}

                    <Button onClick={goToSignature} disabled={pending} className="w-full">
                        ยืนยันรับที่บูธ
                    </Button>

                    <Button variant="ghost" size="sm" onClick={scanNext} className="w-full" disabled={pending}>
                        ยกเลิก / สแกนใหม่
                    </Button>
                </Card>
            )}

            {data && mode === "signature" && (
                <Card className="p-5 sm:p-6 space-y-4">
                    <div>
                        <p className="eyebrow">ยืนยันรับที่บูธ</p>
                        <p className="text-sm text-ink-soft mt-1">{data.fullName} · BIB {data.bib}</p>
                    </div>

                    <div>
                        <p className="text-[12px] text-ink-mute mb-2">ให้ผู้สมัครเซ็นด้วยนิ้วในกรอบด้านล่าง เป็นหลักฐานการรับของ</p>
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

            {data && mode === "success" && (
                <Card className="p-5 sm:p-6 space-y-5">
                    <Notice tone="lime" title="บันทึกสำเร็จ">
                        {data.fullName} · BIB {data.bib} — {PICKUP_LABEL[data.pickupStatus] ?? data.pickupStatus}
                    </Notice>

                    <dl className="grid grid-cols-2 gap-4 text-sm">
                        <Field label="งาน" value={data.eventTitle} className="col-span-2" />
                        {data.pickupAt && (
                            <Field
                                label="เวลาที่ยืนยัน"
                                value={`${formatDate(data.pickupAt)} ${formatTime(data.pickupAt)}`}
                                className="col-span-2"
                            />
                        )}
                        {data.shippingTrackingNo && <Field label="เลขพัสดุ" value={data.shippingTrackingNo} className="col-span-2" />}
                    </dl>

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

function Field({ label, value, className }: { label: string; value: string; className?: string }) {
    return (
        <div className={className}>
            <dt className="text-[11px] text-ink-mute">{label}</dt>
            <dd className="font-medium tracking-tight mt-0.5">{value}</dd>
        </div>
    )
}

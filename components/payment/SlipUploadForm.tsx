'use client'

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import { uploadSlip } from "@/app/actions/registration"
import { Button, Spinner } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"

export function SlipUploadForm({ registrationId }: { registrationId: string }) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const [fileName, setFileName] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setError(null)
        const file = e.target.files?.[0]
        if (!file) {
            setPreview(null)
            setFileName(null)
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            setError("ไฟล์ต้องมีขนาดไม่เกิน 5MB")
            e.target.value = ""
            return
        }
        setFileName(file.name)
        setPreview(URL.createObjectURL(file))
    }

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        setSuccess(null)
        const formData = new FormData(e.currentTarget)
        formData.set("registrationId", registrationId)

        startTransition(async () => {
            const res = await uploadSlip(formData)
            if (!res.ok) setError(res.error)
            else {
                setSuccess(res.message ?? "ส่งสลิปเรียบร้อย")
                setPreview(null)
                setFileName(null)
                if (inputRef.current) inputRef.current.value = ""
                router.refresh()
            }
        })
    }

    return (
        <form onSubmit={onSubmit} className="space-y-5">
            <div>
                <p className="eyebrow mb-3">สลิปการโอนเงิน</p>

                <label
                    htmlFor="slip"
                    className="flex flex-col items-center justify-center gap-2 w-full min-h-40 p-5 rounded-3xl border border-dashed border-line hover:border-ink-mute cursor-pointer transition-colors"
                >
                    {preview ? (
                        <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={preview} alt="ตัวอย่างสลิป" className="max-h-52 rounded-xl object-contain" />
                            <span className="text-[11px] text-ink-mute truncate max-w-full mt-1">{fileName}</span>
                            <span className="eyebrow text-ink">เปลี่ยนรูป</span>
                        </>
                    ) : (
                        <>
                            <span className="text-sm font-semibold">เลือกรูปสลิป</span>
                            <span className="text-[11px] text-ink-mute">JPG, PNG, WEBP · ไม่เกิน 5MB</span>
                        </>
                    )}
                </label>

                <input
                    ref={inputRef}
                    id="slip"
                    type="file"
                    name="slip"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    required
                    onChange={onFileChange}
                    className="sr-only"
                />
            </div>

            {error && <Notice tone="move">{error}</Notice>}
            {success && <Notice tone="lime">{success}</Notice>}

            <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {pending ? <Spinner /> : "ส่งสลิป"}
            </Button>
        </form>
    )
}

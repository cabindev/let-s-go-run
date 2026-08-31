'use client'

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import type { EventImage, ImageCategory } from "@prisma/client"
import { addEventImages, deleteEventImage, moveEventImage } from "@/app/actions/admin"
import { Button, Spinner } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"
import { ConfirmAction } from "./ConfirmAction"
import { IMAGE_GROUPS, groupField, type ImageGroup } from "@/lib/image-groups"

/** จัดการรูปประกอบของงาน แยกตามหมวด */
export function GalleryManager({ eventId, images }: { eventId: string; images: EventImage[] }) {
    return (
        <section className="space-y-5">
            <div className="flex items-baseline justify-between gap-4">
                <div>
                    <p className="eyebrow">รูปประกอบ</p>
                    <p className="text-[12px] text-ink-mute mt-1">ทุกหมวดไม่บังคับ · แนบกี่รูปก็ได้</p>
                </div>
                <span className="eyebrow tnum">{images.length} รูป</span>
            </div>

            <div className="space-y-4">
                {IMAGE_GROUPS.map((g) => (
                    <GroupSection
                        key={g.key}
                        eventId={eventId}
                        group={g}
                        images={images.filter((i) => i.category === g.key)}
                    />
                ))}
            </div>
        </section>
    )
}

function GroupSection({
    eventId,
    group,
    images,
}: {
    eventId: string
    group: ImageGroup
    images: EventImage[]
}) {
    const router = useRouter()
    const inputRef = useRef<HTMLInputElement>(null)
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [picked, setPicked] = useState<string[]>([])

    const id = `add-${group.key}`

    const upload = () => {
        setError(null)
        const files = inputRef.current?.files
        if (!files?.length) return

        const fd = new FormData()
        for (const f of files) fd.append(groupField(group.key), f)

        startTransition(async () => {
            const res = await addEventImages(eventId, fd)
            if (!res.ok) setError(res.error)
            else {
                setPicked([])
                if (inputRef.current) inputRef.current.value = ""
                router.refresh()
            }
        })
    }

    const move = (imageId: string, dir: "up" | "down") => {
        setError(null)
        startTransition(async () => {
            const res = await moveEventImage(imageId, dir)
            if (!res.ok) setError(res.error)
            else router.refresh()
        })
    }

    return (
        <div className="border border-line rounded-2xl p-4 bg-paper">
            <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-semibold tracking-tight">
                        {group.label}
                        {images.length === 0 && <span className="ml-2 text-[11px] font-medium text-ink-mute">ยังไม่มีรูป</span>}
                    </p>
                    <p className="text-[11px] text-ink-mute mt-0.5">
                        {group.hint}
                        {group.suggested > 0 && ` · แนะนำ ${group.suggested} รูป`}
                    </p>
                </div>
                <span className="eyebrow tnum shrink-0">{images.length}</span>
            </div>

            {images.length > 0 && (
                <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    {images.map((img, i) => (
                        <li key={img.id} className="rounded-xl border border-line overflow-hidden">
                            <a href={img.url} target="_blank" rel="noreferrer" className="block bg-paper-2">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img.url} alt={img.caption ?? ""} className="w-full aspect-square object-cover" />
                            </a>
                            <div className="flex items-center justify-between gap-1 px-1.5 py-1">
                                <div className="flex">
                                    <button
                                        type="button" onClick={() => move(img.id, "up")} disabled={pending || i === 0}
                                        aria-label="เลื่อนซ้าย"
                                        className="w-6 h-6 rounded text-ink-mute hover:text-ink disabled:opacity-25 transition-colors"
                                    >←</button>
                                    <button
                                        type="button" onClick={() => move(img.id, "down")} disabled={pending || i === images.length - 1}
                                        aria-label="เลื่อนขวา"
                                        className="w-6 h-6 rounded text-ink-mute hover:text-ink disabled:opacity-25 transition-colors"
                                    >→</button>
                                </div>
                                <ConfirmAction
                                    action={deleteEventImage.bind(null, img.id)}
                                    title="ลบรูปนี้?"
                                    message={`รูปในหมวด "${group.label}" จะถูกนำออกจากหน้างาน`}
                                    confirmLabel="ลบ"
                                    className="eyebrow text-ink-mute hover:text-danger transition-colors px-1"
                                >ลบ</ConfirmAction>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <label
                htmlFor={id}
                className="mt-4 flex items-center justify-center w-full h-10 rounded-xl border border-dashed border-line hover:border-ink-mute cursor-pointer transition-colors text-[13px] font-semibold text-ink-soft"
            >
                {picked.length > 0 ? `เลือกไว้ ${picked.length} รูป · เปลี่ยน` : images.length > 0 ? "เพิ่มรูป" : "เลือกรูป"}
            </label>
            <input
                ref={inputRef}
                id={id}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(e) => setPicked([...(e.target.files ?? [])].map((f) => URL.createObjectURL(f)))}
            />

            {picked.length > 0 && (
                <>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3">
                        {picked.map((src, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={src} alt="" className="w-full aspect-square object-cover rounded-lg border border-line" />
                        ))}
                    </div>
                    <Button type="button" size="sm" className="mt-3" onClick={upload} disabled={pending}>
                        {pending ? <Spinner /> : `อัปโหลด ${picked.length} รูป`}
                    </Button>
                </>
            )}

            {error && <Notice tone="danger" className="mt-3">{error}</Notice>}
        </div>
    )
}

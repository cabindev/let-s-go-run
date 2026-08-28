'use client'

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import { createAchievement } from "@/app/actions/admin"
import { Button, Spinner } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Badge"
import { Field, Select } from "@/components/ui/Field"
import { ACHIEVEMENT_TYPE_LABEL } from "@/lib/achievements"

export function AchievementForm() {
    const router = useRouter()
    const formRef = useRef<HTMLFormElement>(null)
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        const formData = new FormData(e.currentTarget)
        startTransition(async () => {
            const res = await createAchievement(formData)
            if (!res.ok) setError(res.error)
            else {
                formRef.current?.reset()
                router.refresh()
            }
        })
    }

    return (
        <form ref={formRef} onSubmit={onSubmit} className="space-y-7 bg-paper border border-line rounded-3xl p-6">
            <p className="eyebrow">เพิ่มความสำเร็จใหม่</p>

            <div className="grid grid-cols-[72px_1fr] gap-5">
                <Field label="ไอคอน" name="icon" maxLength={4} defaultValue="🏅" className="[&_input]:text-center [&_input]:text-xl" />
                <Field label="ชื่อ" name="name" required maxLength={80} placeholder="นักวิ่งหน้าใหม่" />
            </div>

            <Field label="คำอธิบาย" name="description" maxLength={200} placeholder="เข้าร่วมกิจกรรมแรกสำเร็จ" />

            <div className="grid sm:grid-cols-2 gap-5">
                <Select label="เกณฑ์" name="type" defaultValue="EVENT_COUNT">
                    {Object.entries(ACHIEVEMENT_TYPE_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                    ))}
                </Select>
                <Field label="ค่าที่ต้องถึง" name="threshold" type="number" step="any" min="0.1" required defaultValue={1} />
            </div>

            {error && <Notice tone="move">{error}</Notice>}

            <Button type="submit" disabled={pending}>
                {pending ? <Spinner /> : "เพิ่มความสำเร็จ"}
            </Button>
        </form>
    )
}

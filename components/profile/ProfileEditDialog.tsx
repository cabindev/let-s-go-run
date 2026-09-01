'use client'

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { X } from "lucide-react"
import { updateProfile, changePassword } from "@/app/actions/profile"
import { Button, Spinner } from "@/components/ui/Button"
import { Avatar } from "@/components/ui/Avatar"
import { Notice } from "@/components/ui/Badge"
import { Field, TextArea, inputClass } from "@/components/ui/Field"
import { PasswordField } from "@/components/auth/PasswordField"
import { cn } from "@/lib/utils"

interface Props {
    user: {
        name: string | null
        email: string
        image: string | null
        phone: string | null
        bio: string | null
        dateOfBirth: Date | null
    }
}

export function ProfileEditDialog({ user }: Props) {
    const [open, setOpen] = useState(false)
    const [tab, setTab] = useState<"profile" | "password">("profile")

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="h-9 px-4 rounded-full border border-line text-[15px] font-semibold tracking-tight text-ink hover:border-ink-mute transition-colors shrink-0"
            >
                แก้ไข
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                    <div className="absolute inset-0 bg-ink/25 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="ตั้งค่าบัญชี"
                        className="relative w-full sm:max-w-md bg-paper rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto animate-rise shadow-2xl shadow-black/15"
                    >
                        <div className="sticky top-0 bg-paper px-6 py-5 flex items-center justify-between">
                            <p className="eyebrow">ตั้งค่าบัญชี</p>
                            <button type="button" onClick={() => setOpen(false)} aria-label="ปิด" className="p-1 -mr-1 text-ink-mute hover:text-ink transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="px-6 flex gap-6 border-b border-line">
                            <Tab active={tab === "profile"} onClick={() => setTab("profile")}>ข้อมูลส่วนตัว</Tab>
                            <Tab active={tab === "password"} onClick={() => setTab("password")}>รหัสผ่าน</Tab>
                        </div>

                        <div className="p-6">
                            {tab === "profile" ? (
                                <ProfileForm user={user} onDone={() => setOpen(false)} />
                            ) : (
                                <PasswordForm onDone={() => setOpen(false)} />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "pb-3 -mb-px border-b-2 text-[15px] font-semibold tracking-tight transition-colors",
                active ? "border-ink text-ink" : "border-transparent text-ink-mute hover:text-ink-soft"
            )}
        >
            {children}
        </button>
    )
}

function ProfileForm({ user, onDone }: { user: Props["user"]; onDone: () => void }) {
    const router = useRouter()
    const { update } = useSession()
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [preview, setPreview] = useState<string | null>(user.image)

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        const formData = new FormData(e.currentTarget)
        startTransition(async () => {
            const res = await updateProfile(formData)
            if (!res.ok) setError(res.error)
            else {
                await update()
                router.refresh()
                onDone()
            }
        })
    }

    const dob = user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().slice(0, 10) : ""

    return (
        <form onSubmit={onSubmit} className="space-y-7">
            <div className="flex items-center gap-4">
                <Avatar src={preview} name={user.name} email={user.email} size={64} />
                <label className="cursor-pointer">
                    <span className="inline-flex items-center h-9 px-4 rounded-full border border-line text-[15px] font-semibold text-ink hover:border-ink-mute transition-colors">
                        เปลี่ยนรูป
                    </span>
                    <input
                        type="file"
                        name="image"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) setPreview(URL.createObjectURL(f))
                        }}
                    />
                </label>
            </div>

            <Field label="ชื่อ-นามสกุล" name="name" defaultValue={user.name ?? ""} required />

            <div>
                <p className="eyebrow mb-2">อีเมล</p>
                <input value={user.email} disabled className={`${inputClass} h-11`} />
            </div>

            <Field label="เบอร์โทรศัพท์" name="phone" type="tel" defaultValue={user.phone ?? ""} placeholder="08x-xxx-xxxx" />
            <Field label="วันเกิด" name="dateOfBirth" type="date" defaultValue={dob} />
            <TextArea label="แนะนำตัว" name="bio" rows={3} maxLength={300} defaultValue={user.bio ?? ""} placeholder="เล่าเกี่ยวกับตัวคุณสั้น ๆ" />

            {error && <Notice tone="danger">{error}</Notice>}

            <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onDone} disabled={pending}>ยกเลิก</Button>
                <Button type="submit" className="flex-1" disabled={pending}>
                    {pending ? <Spinner /> : "บันทึก"}
                </Button>
            </div>
        </form>
    )
}

function PasswordForm({ onDone }: { onDone: () => void }) {
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        setSuccess(null)
        const formData = new FormData(e.currentTarget)
        const form = e.currentTarget
        startTransition(async () => {
            const res = await changePassword(formData)
            if (!res.ok) setError(res.error)
            else {
                setSuccess(res.message ?? "เปลี่ยนรหัสผ่านแล้ว")
                form.reset()
            }
        })
    }

    return (
        <form onSubmit={onSubmit} className="space-y-7">
            <PasswordField label="รหัสผ่านปัจจุบัน" name="currentPassword" required autoComplete="current-password" />
            <PasswordField label="รหัสผ่านใหม่" name="newPassword" required minLength={5} autoComplete="new-password" />

            {error && <Notice tone="danger">{error}</Notice>}
            {success && <Notice tone="lime">{success}</Notice>}

            <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onDone} disabled={pending}>ปิด</Button>
                <Button type="submit" className="flex-1" disabled={pending}>
                    {pending ? <Spinner /> : "เปลี่ยนรหัสผ่าน"}
                </Button>
            </div>
        </form>
    )
}

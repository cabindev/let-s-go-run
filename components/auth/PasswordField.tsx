'use client'

import { useState } from "react"
import { inputClass } from "@/components/ui/Field"

/** ช่องรหัสผ่าน — ปุ่มสลับใช้ตัวอักษรแทนไอคอนรูปตา */
export function PasswordField({
    label, name, ...props
}: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
    const [show, setShow] = useState(false)

    return (
        <div>
            <div className="flex items-baseline justify-between mb-2">
                <label htmlFor={name} className="eyebrow">
                    {label}{props.required && <span className="text-danger ml-1">*</span>}
                </label>
                <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="eyebrow text-ink-mute hover:text-ink transition-colors"
                >
                    {show ? "ซ่อน" : "แสดง"}
                </button>
            </div>
            <input id={name} name={name} type={show ? "text" : "password"} className={`${inputClass} h-11`} {...props} />
        </div>
    )
}

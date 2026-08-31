import { cn } from "@/lib/utils"

export const inputClass =
    "w-full bg-transparent border-b border-line text-[15px] tracking-tight text-ink placeholder:text-ink-mute " +
    "focus:outline-none focus:border-ink transition-colors disabled:text-ink-mute disabled:bg-paper-2"

/** ช่องกรอกแบบเส้นใต้ — ไม่มีกล่อง ไม่มีไอคอน */
export function Field({
    label, name, helper, className, ...props
}: { label: string; name: string; helper?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div className={className}>
            <label htmlFor={name} className="eyebrow block mb-2">
                {label}{props.required && <span className="text-danger ml-1">*</span>}
            </label>
            <input id={name} name={name} className={cn(inputClass, "h-11")} {...props} />
            {helper && <p className="text-[11px] text-ink-mute mt-2">{helper}</p>}
        </div>
    )
}

export function TextArea({
    label, name, helper, className, ...props
}: { label: string; name: string; helper?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return (
        <div className={className}>
            <label htmlFor={name} className="eyebrow block mb-2">
                {label}{props.required && <span className="text-danger ml-1">*</span>}
            </label>
            <textarea id={name} name={name} className={cn(inputClass, "py-2 resize-y")} {...props} />
            {helper && <p className="text-[11px] text-ink-mute mt-2">{helper}</p>}
        </div>
    )
}

export function Select({
    label, name, className, children, ...props
}: { label: string; name: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <div className={className}>
            <label htmlFor={name} className="eyebrow block mb-2">{label}</label>
            <select id={name} name={name} className={cn(inputClass, "h-11")} {...props}>
                {children}
            </select>
        </div>
    )
}

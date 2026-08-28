import { ButtonLink } from "./Button"

/** สถานะว่าง — ไม่มีไอคอน ใช้ตัวอักษรกับพื้นที่ว่างแทน */
export function EmptyState({
    title,
    description,
    actionLabel,
    actionHref,
}: {
    title: string
    description?: string
    actionLabel?: string
    actionHref?: string
}) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6">
            <p className="display text-lg text-ink">{title}</p>
            {description && <p className="text-sm text-ink-soft mt-2 max-w-xs">{description}</p>}
            {actionLabel && actionHref && (
                <ButtonLink href={actionHref} size="sm" className="mt-6">
                    {actionLabel}
                </ButtonLink>
            )}
        </div>
    )
}

import { Wordmark } from "@/components/layout/Wordmark"

/** เปลือกหน้า auth — เต็มจอ ดำ ตัวหนังสือใหญ่ */
export function AuthLayout({
    eyebrow,
    title,
    children,
    footer,
}: {
    eyebrow: string
    title: string
    children: React.ReactNode
    footer: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-paper flex flex-col">
            <header className="h-20 px-5 sm:px-8 flex items-center max-w-md w-full mx-auto">
                <Wordmark />
            </header>

            <main className="flex-1 flex items-center px-5 sm:px-8 pb-16">
                <div className="w-full max-w-md mx-auto animate-rise">
                    <p className="eyebrow">{eyebrow}</p>
                    <h1 className="display text-3xl sm:text-4xl mt-2 mb-9">{title}</h1>
                    {children}
                    <div className="mt-10 text-sm text-ink-soft">{footer}</div>
                </div>
            </main>
        </div>
    )
}

import Link from "next/link"
import { Wordmark } from "./Wordmark"

export function Footer() {
    return (
        <footer className="border-t border-line mt-20">
            <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <Wordmark />
                    <p className="text-[14px] text-ink-mute mt-3">ระบบรับสมัครงานวิ่ง</p>
                    <p className="text-[14px] text-ink-mute mt-1">
                        34 หมู่ 7 ตำบลยุหว่า อำเภอสันป่าตอง จังหวัดเชียงใหม่ 50120
                    </p>
                    <p className="text-[14px] text-ink-mute">โทร. +66 65 993 5647</p>
                </div>

                <nav className="flex flex-wrap gap-x-6 gap-y-2">
                    <Link href="/" className="text-[15px] text-ink-soft hover:text-ink transition-colors">งานวิ่ง</Link>
                    <Link href="/leaderboard" className="text-[15px] text-ink-soft hover:text-ink transition-colors">อันดับ</Link>
                    <Link href="/profile" className="text-[15px] text-ink-soft hover:text-ink transition-colors">โปรไฟล์</Link>
                </nav>
            </div>
        </footer>
    )
}

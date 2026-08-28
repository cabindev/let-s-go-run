import Link from "next/link"

export default function NotFound() {
    return (
        <div className="min-h-screen bg-paper-2 flex flex-col items-center justify-center px-5 text-center">
            <p className="numeral text-[clamp(4rem,15vw,8rem)] text-ink-mute/30">404</p>
            <h1 className="display text-xl mt-4">ไม่พบหน้าที่คุณต้องการ</h1>
            <p className="text-sm text-ink-soft mt-3 max-w-xs">หน้านี้อาจถูกลบ ย้ายที่ หรือลิงก์ไม่ถูกต้อง</p>
            <div className="flex flex-wrap gap-3 justify-center mt-8">
                <Link href="/" className="h-12 px-6 inline-flex items-center rounded-full bg-ink text-paper-2 text-sm font-semibold tracking-tight hover:bg-ink/90 transition-colors">
                    หน้าหลัก
                </Link>
                <Link href="/" className="h-12 px-6 inline-flex items-center rounded-full border border-line text-sm font-semibold tracking-tight hover:border-ink-mute transition-colors">
                    ดูกิจกรรม
                </Link>
            </div>
        </div>
    )
}

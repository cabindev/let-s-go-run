import { requireAdminPage } from "@/lib/auth-helpers"
import { CheckinScanner } from "@/components/admin/CheckinScanner"

export const metadata = { title: "เช็คอินรับเสื้อ · RunLudtong" }

export default async function AdminCheckinPage() {
    await requireAdminPage()

    return (
        <div className="space-y-6">
            <div>
                <p className="eyebrow">หน้างาน</p>
                <h1 className="display text-3xl sm:text-4xl mt-2">เช็คอินรับเสื้อ</h1>
                <p className="text-sm text-ink-mute mt-2">
                    ยื่น QR ของผู้สมัครให้กล้องมือถือ/แท็บเล็ตเครื่องนี้เห็น เพื่อดึงข้อมูลและยืนยันการรับของ
                </p>
            </div>

            <CheckinScanner />
        </div>
    )
}

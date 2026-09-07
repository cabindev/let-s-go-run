import Link from "next/link"
import { cn } from "@/lib/utils"

/**
 * โลโก้ RunLudtong — ใช้ไฟล์ SVG แทนโลโก้ตัวอักษรเดิม
 *
 * ตัวโลโก้เป็นตราสี่เหลี่ยมพื้นทึบ (490×440) ที่มีชื่อแบรนด์อยู่ข้างในแล้ว
 * จึงไม่ต้องมีข้อความกำกับซ้ำ — กำหนดความสูงเป็นหลักแล้วให้ความกว้างไหลตามสัดส่วน
 * กัน layout กระโดดตอนรูปโหลดด้วยการระบุ width/height จริงของไฟล์
 */
export function Wordmark({ className, sub }: { className?: string; sub?: string }) {
    return (
        <Link
            href="/"
            aria-label="RunLudtong หน้าแรก"
            className={cn("inline-flex flex-col leading-none", className)}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/runludtong-logo.svg"
                alt="RunLudtong"
                width={490}
                height={440}
                className="h-10 w-auto rounded-md"
            />
            {sub && <span className="eyebrow mt-1.5">{sub}</span>}
        </Link>
    )
}

import { cn } from "@/lib/utils"

/**
 * ข้อความหลายบรรทัดจากผู้ใช้ (รายละเอียดงาน / สิ่งที่ได้รับ)
 *
 * เนื้อหาที่วางมาจาก Facebook, Word หรือ rich-text editor มักมีบรรทัดว่างติดกัน
 * หลายสิบบรรทัด ทำให้เกิดช่องโหว่กลางหน้า จึงยุบให้เหลือ "บรรทัดว่างเดียว" ตอนแสดงผล
 * โดยไม่แตะข้อมูลต้นฉบับในฐานข้อมูล
 */
export function RichText({ children, className }: { children: string; className?: string }) {
    const text = children
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+$/gm, "")      // ตัดช่องว่างท้ายบรรทัด
        .replace(/\n{3,}/g, "\n\n")    // ยุบบรรทัดว่างซ้อนให้เหลือหนึ่ง
        .trim()

    return (
        <p className={cn("text-ink-soft leading-relaxed whitespace-pre-wrap", className)}>
            {text}
        </p>
    )
}

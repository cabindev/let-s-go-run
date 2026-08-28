import type { ImageCategory } from "@prisma/client"
import { Gallery } from "./Gallery"
import { GROUP_LABEL } from "@/lib/image-groups"

interface Img {
    id: string
    url: string
    caption: string | null
    category: ImageCategory
    width?: number | null
    height?: number | null
}

/** บรรยากาศงานมักมีหลายรูป จึงยังใช้ตารางย่อ ส่วนหมวดอื่นแสดงเต็มความกว้าง */
const GRID_CATEGORIES: ImageCategory[] = ["ATMOSPHERE"]

/**
 * รูปประกอบของหมวดเดียว พร้อมหัวข้อ
 * ไม่มีรูปในหมวดนั้น = ไม่แสดงอะไรเลย (ทุกหมวดไม่บังคับ)
 */
export function ImageSection({
    images,
    category,
    title,
}: {
    images: Img[]
    category: ImageCategory
    /** ทับชื่อหมวดเริ่มต้นได้ */
    title?: string
}) {
    const list = images.filter((i) => i.category === category)
    if (list.length === 0) return null

    return (
        <section>
            <p className="eyebrow mb-3">{title ?? GROUP_LABEL[category]}</p>
            <Gallery images={list} layout={GRID_CATEGORIES.includes(category) ? "grid" : "stack"} />
        </section>
    )
}

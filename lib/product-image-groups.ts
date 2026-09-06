import type { ProductImage, ProductImageCategory } from "@prisma/client"

/**
 * หมวดรูปสินค้า — แก้ที่ไฟล์นี้ที่เดียว มีผลทั้งฟอร์มอัปโหลด หน้าแอดมิน และหน้าสินค้า
 *
 * `required` = ต้องมีอย่างน้อย 1 รูปก่อนตั้งสถานะเป็น "เปิดขาย"
 * ตอนนี้บังคับแค่ ด้านหน้า + ด้านหลัง ที่เหลือเพิ่มได้แต่ไม่บังคับ
 */
export interface ProductImageGroup {
    key: ProductImageCategory
    label: string
    hint: string
    suggested: number
    required: boolean
}

export const PRODUCT_IMAGE_GROUPS: ProductImageGroup[] = [
    { key: "FRONT", label: "ด้านหน้า", hint: "ภาพสินค้าด้านหน้าเต็มชิ้น พื้นหลังเรียบ", suggested: 1, required: true },
    { key: "BACK", label: "ด้านหลัง", hint: "ภาพสินค้าอีกด้าน พื้นหลังเรียบ", suggested: 1, required: true },
    { key: "MODEL", label: "ตัวอย่าง", hint: "ภาพตอนใช้งานจริง หรือเทียบขนาดกับของใกล้ตัว ช่วยให้ลูกค้าเห็นของจริงและตัดสินใจง่ายขึ้น", suggested: 2, required: false },
    { key: "DETAIL", label: "รายละเอียด", hint: "ภาพระยะใกล้ให้เห็นเนื้อวัสดุ งานพิมพ์ หรือจุดเด่นของสินค้า", suggested: 2, required: false },
    { key: "SIZE_GUIDE", label: "ตารางขนาด", hint: "ตารางไซส์ หรือสเปก/ขนาดของสินค้า", suggested: 1, required: false },
    { key: "OTHER", label: "อื่น ๆ", hint: "รูปประกอบอื่นที่ไม่เข้าหมวดข้างบน", suggested: 0, required: false },
]

export const PRODUCT_GROUP_LABEL: Record<ProductImageCategory, string> = Object.fromEntries(
    PRODUCT_IMAGE_GROUPS.map((g) => [g.key, g.label])
) as Record<ProductImageCategory, string>

/** หมวดที่บังคับต้องมีก่อนเปิดขาย */
export const REQUIRED_PRODUCT_IMAGE_GROUPS = PRODUCT_IMAGE_GROUPS.filter((g) => g.required)

/** ชื่อ input ของแต่ละหมวด เช่น productImage:FRONT */
export const productGroupField = (key: ProductImageCategory) => `productImage:${key}`

/** ตรวจว่าค่าที่ส่งมาเป็นหมวดจริงหรือไม่ (กันค่ามั่วจากฟอร์ม) */
export function isProductImageCategory(value: string): value is ProductImageCategory {
    return PRODUCT_IMAGE_GROUPS.some((g) => g.key === value)
}

/**
 * รูปปกของสินค้า — ใช้ "ด้านหน้า" ก่อนเสมอ ถ้ายังไม่มีค่อยไล่ไปรูปแรกที่มี
 * เพื่อให้การ์ดบนหน้าร้านและหน้าแรกแสดงมุมเดียวกันทุกใบ
 */
export function coverImage<T extends Pick<ProductImage, "url" | "category" | "sortOrder">>(
    images: T[]
): T | null {
    if (images.length === 0) return null
    const byOrder = [...images].sort((a, b) => a.sortOrder - b.sortOrder)
    return byOrder.find((i) => i.category === "FRONT") ?? byOrder[0]
}

/**
 * หมวดที่บังคับแต่ยังไม่มีรูป — คืนเป็นรายชื่อ label เพื่อเอาไปขึ้นข้อความบอกแอดมิน
 * (คืน array ว่าง = ครบแล้ว)
 */
export function missingRequiredGroups(categories: ProductImageCategory[]) {
    const have = new Set(categories)
    return REQUIRED_PRODUCT_IMAGE_GROUPS.filter((g) => !have.has(g.key)).map((g) => g.label)
}

import type { OrderStatus, Product, ProductType, ProductVariant, ShopSetting } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { Tone } from "@/components/ui/Badge"

/** ชื่อร้าน — ใช้บนหัวหน้าเพจและเป็นชื่อรายการบนหน้าจ่ายเงินของ Stripe */
export const SHOP_NAME = "ร้านค้ารันลัดโต้ง"

/** ต้องชำระเงินให้เสร็จภายในกี่ชั่วโมงหลังสั่ง — เท่ากับฝั่งสมัครวิ่ง (lib/expiry.ts) */
export const ORDER_PAYMENT_WINDOW_HOURS = 24

export function orderDeadline(from: Date = new Date()) {
    return new Date(from.getTime() + ORDER_PAYMENT_WINDOW_HOURS * 3600_000)
}

/** สถานะที่ยังชำระเงินได้ / ยังคืนสต็อกได้ */
export const ORDER_PAYABLE_STATUS: OrderStatus[] = ["PENDING"]

/** สถานะที่ยัง "จอง" สต็อกอยู่ — ใช้ตัดสินว่าต้องคืนสต็อกไหมตอนยกเลิก */
export const ORDER_HOLDS_STOCK: OrderStatus[] = ["PENDING", "PAID", "PREPARING", "SHIPPED", "COMPLETED"]

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
    STOCK: "พร้อมส่ง",
    PREORDER: "พรีออเดอร์",
}

export const PRODUCT_TYPE_TONE: Record<ProductType, Tone> = {
    STOCK: "lime",
    PREORDER: "move",
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
    PENDING: { label: "รอชำระเงิน", tone: "ink" },
    PAID: { label: "ชำระแล้ว", tone: "lime" },
    PREPARING: { label: "กำลังจัดเตรียม", tone: "sky" },
    SHIPPED: { label: "จัดส่งแล้ว", tone: "sky" },
    COMPLETED: { label: "รับของแล้ว", tone: "lime" },
    CANCELLED: { label: "ยกเลิกแล้ว", tone: "neutral" },
    EXPIRED: { label: "หมดเวลาชำระ", tone: "outline" },
    REFUNDED: { label: "คืนเงินแล้ว", tone: "outline" },
}

export const DELIVERY_LABEL = {
    PICKUP: "รับด้วยตนเอง",
    SHIPPING: "ส่งไปรษณีย์",
} as const

/**
 * ค่าส่งไปรษณีย์ — ชิ้นแรกคิดเต็ม ชิ้นถัดไปบวกชิ้นละ extraPerItem
 * นับจาก "จำนวนชิ้นรวม" ไม่ใช่จำนวนรายการ (สั่งไซส์เดียว 3 ตัว = 3 ชิ้น)
 */
export function shippingFee(
    totalQty: number,
    setting: Pick<ShopSetting, "shippingBaseFee" | "shippingExtraPerItem">
) {
    if (totalQty <= 0) return 0
    return setting.shippingBaseFee + (totalQty - 1) * setting.shippingExtraPerItem
}

/** ราคาที่ใช้จริงของตัวเลือกนี้ — variant ตั้งราคาทับได้ ไม่ตั้งก็ใช้ราคาสินค้า */
export function variantPrice(
    product: Pick<Product, "price">,
    variant: Pick<ProductVariant, "price">
) {
    return variant.price ?? product.price
}

/** สินค้าตัวนี้ยังกดซื้อได้อยู่ไหม (พร้อมเหตุผลถ้าไม่ได้) */
export function purchasableState(
    product: Pick<Product, "status" | "type" | "preorderCloseAt">,
    now: Date = new Date()
): { ok: true } | { ok: false; reason: string } {
    if (product.status !== "ACTIVE") return { ok: false, reason: "สินค้านี้ยังไม่เปิดขาย" }
    if (product.type === "PREORDER" && product.preorderCloseAt && product.preorderCloseAt < now) {
        return { ok: false, reason: "ปิดรับพรีออเดอร์แล้ว" }
    }
    return { ok: true }
}

export function isPurchasable(
    product: Pick<Product, "status" | "type" | "preorderCloseAt">,
    now: Date = new Date()
) {
    return purchasableState(product, now).ok
}

/**
 * ป้ายบอกสต็อก — โจทย์ต้องการให้ "เหลือเท่าไหร่ / หมด" ชัดเจนแบบเว็บขายของ
 * stock = null คือไม่จำกัดจำนวน (ใช้กับพรีออเดอร์ที่ผลิตตามยอดสั่ง)
 */
export function stockLabel(stock: number | null): { label: string; tone: Tone; soldOut: boolean } {
    if (stock === null) return { label: "พร้อมรับออเดอร์", tone: "outline", soldOut: false }
    if (stock <= 0) return { label: "สินค้าหมด", tone: "neutral", soldOut: true }
    if (stock <= 5) return { label: `เหลือ ${stock} ชิ้นสุดท้าย`, tone: "danger", soldOut: false }
    return { label: `เหลือ ${stock} ชิ้น`, tone: "outline", soldOut: false }
}

/** สินค้าตัวนี้ยังมีของให้ซื้ออยู่ไหม (ดูรวมทุก variant ที่เปิดใช้) */
export function hasStock(variants: Pick<ProductVariant, "stock" | "active">[]) {
    return variants.some((v) => v.active && (v.stock === null || v.stock > 0))
}

/** จำนวนสูงสุดที่กดสั่งได้ของตัวเลือกนี้ — น้อยกว่าระหว่างสต็อกจริงกับเพดานต่อออเดอร์ */
export function maxOrderable(
    product: Pick<Product, "maxPerOrder">,
    variant: Pick<ProductVariant, "stock">
) {
    if (variant.stock === null) return product.maxPerOrder
    return Math.max(0, Math.min(product.maxPerOrder, variant.stock))
}

/**
 * ตั้งค่าร้าน — มีแถวเดียวเสมอ สร้างด้วยค่าเริ่มต้นให้อัตโนมัติถ้ายังไม่เคยตั้ง
 * (แอดมินแก้ได้ที่ /admin/shop/settings)
 */
export async function getShopSetting(): Promise<ShopSetting> {
    return prisma.shopSetting.upsert({
        where: { id: "default" },
        update: {},
        create: { id: "default" },
    })
}

/**
 * แปลงชื่อสินค้าเป็น slug สำหรับ URL — เก็บอักษรไทยไว้ได้ (เบราว์เซอร์เข้ารหัสให้เอง)
 * เพราะสินค้าส่วนใหญ่ชื่อไทย ถ้าตัดทิ้งหมดจะเหลือแต่ขีดกลาง
 */
export function slugify(input: string) {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9฀-๿\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "")
}

/**
 * เลขที่ออเดอร์แบบอ่านง่ายสำหรับคุยกับลูกค้า เช่น RL-690906-4T9K2X
 *
 * ท้ายเป็นค่าสุ่ม ไม่ใช่ running number เพื่อไม่ให้เดายอดขายรายวันได้จากเลขที่
 * และไม่ต้องมีตัวนับกลางที่กลายเป็นคอขวดตอนคนสั่งพร้อมกัน
 *
 * ใช้ 6 ตัวจากชุดอักษร 32 ตัว (~1,000 ล้านค่าต่อวัน) แทนเลข 4 หลักที่มีแค่ 10,000 ค่า —
 * ของเดิมทดสอบสุ่ม 3,000 ครั้งชนกันถึง 14% ซึ่งทำให้ทรานแซกชันสั่งซื้อล้มโดยไม่จำเป็น
 * ตัดอักษรที่อ่านสับสน (I, O, 0, 1) ออก เพราะต้องอ่านเลขนี้ให้ลูกค้าฟังทางโทรศัพท์ได้
 */
const ORDER_NO_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

export function generateOrderNo(now: Date = new Date()) {
    const pad = (n: number) => String(n).padStart(2, "0")
    const ymd = `${String(now.getFullYear() + 543).slice(-2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    const rand = Array.from(
        { length: 6 },
        () => ORDER_NO_ALPHABET[Math.floor(Math.random() * ORDER_NO_ALPHABET.length)]
    ).join("")
    return `RL-${ymd}-${rand}`
}

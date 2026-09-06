import type { Prisma, ProductType, ShopDelivery, ShopSetting } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { maxOrderable, purchasableState, shippingFee, variantPrice } from "@/lib/shop"

/**
 * ข้อมูลที่ตะกร้าต้องใช้ทุกที่ — ดึงชุดเดียวกันทั้งหน้า /cart, /checkout และตอนสร้างออเดอร์
 * เพื่อให้ยอดที่ผู้ซื้อเห็นกับยอดที่ระบบคิดจริงมาจากแหล่งเดียวกันเสมอ
 */
export const CART_INCLUDE = {
    items: {
        include: {
            variant: {
                include: {
                    product: {
                        include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
                    },
                },
            },
        },
        orderBy: { createdAt: "asc" },
    },
} satisfies Prisma.CartInclude

export type CartWithItems = Prisma.CartGetPayload<{ include: typeof CART_INCLUDE }>
export type CartItemFull = CartWithItems["items"][number]

export interface CartLine {
    itemId: string
    variantId: string
    productId: string
    slug: string
    productName: string
    variantName: string
    type: ProductType
    imageUrl: string | null
    quantity: number
    unitPrice: number
    lineTotal: number
    /** จำนวนสูงสุดที่สั่งได้ตอนนี้ — ใช้จำกัดตัวเลือกจำนวนบนหน้าเว็บ */
    maxQty: number
    /** ปัญหาที่ต้องแก้ก่อนสั่งได้ (null = ไม่มีปัญหา) */
    issue: string | null
    allowPickup: boolean
    allowShipping: boolean
}

/** อ่านตะกร้าของผู้ใช้ (ยังไม่สร้างถ้ายังไม่มี — ใช้กับหน้าอ่านอย่างเดียว) */
export async function getCart(userId: string) {
    return prisma.cart.findUnique({ where: { userId }, include: CART_INCLUDE })
}

/** อ่านตะกร้า สร้างให้ถ้ายังไม่มี — ใช้ตอนกดเพิ่มสินค้า */
export async function getOrCreateCart(userId: string) {
    return prisma.cart.upsert({
        where: { userId },
        update: {},
        create: { userId },
        include: CART_INCLUDE,
    })
}

/**
 * แปลงรายการในตะกร้าเป็นบรรทัดที่คำนวณราคาแล้ว พร้อมตรวจปัญหาของแต่ละชิ้น
 *
 * ราคาคำนวณจาก DB เสมอ ไม่เคยรับค่าจากฝั่ง client — ถ้าแอดมินขึ้นราคาระหว่างที่ของ
 * ค้างอยู่ในตะกร้า ผู้ซื้อจะเห็นราคาใหม่ก่อนกดจ่าย ไม่ใช่โดนตัดเงินตามราคาที่เปลี่ยนไปเงียบๆ
 */
export function buildCartLines(cart: CartWithItems, now: Date = new Date()): CartLine[] {
    return cart.items.map((item) => {
        const { variant } = item
        const { product } = variant
        const unitPrice = variantPrice(product, variant)
        const max = maxOrderable(product, variant)
        const state = purchasableState(product, now)

        let issue: string | null = null
        if (!state.ok) issue = state.reason
        else if (!variant.active) issue = `ตัวเลือก "${variant.name}" ปิดการขายแล้ว`
        else if (variant.stock !== null && variant.stock <= 0) issue = `"${variant.name}" สินค้าหมด`
        else if (item.quantity > max) issue = `"${variant.name}" เหลือไม่พอ (สั่งได้สูงสุด ${max} ชิ้น)`

        return {
            itemId: item.id,
            variantId: variant.id,
            productId: product.id,
            slug: product.slug,
            productName: product.name,
            variantName: variant.name,
            type: product.type,
            imageUrl: product.images[0]?.url ?? null,
            quantity: item.quantity,
            unitPrice,
            lineTotal: unitPrice * item.quantity,
            maxQty: max,
            issue,
            allowPickup: product.allowPickup,
            allowShipping: product.allowShipping,
        }
    })
}

/**
 * แยกบรรทัดตามประเภทสินค้า — สินค้าพร้อมส่งกับพรีออเดอร์คนละรอบจัดส่ง
 * จึงถูกแยกเป็นคนละออเดอร์ตอนกดยืนยัน (แต่ละใบมีค่าส่งและเลขพัสดุของตัวเอง)
 */
export function groupByType(lines: CartLine[]): { type: ProductType; lines: CartLine[] }[] {
    const order: ProductType[] = ["STOCK", "PREORDER"]
    return order
        .map((type) => ({ type, lines: lines.filter((l) => l.type === type) }))
        .filter((g) => g.lines.length > 0)
}

export interface GroupSummary {
    type: ProductType
    lines: CartLine[]
    quantity: number
    subtotal: number
    shippingFee: number
    total: number
}

/** สรุปยอดของออเดอร์หนึ่งใบ — ค่าส่งคิดจากจำนวนชิ้นรวมของใบนั้น */
export function summarizeGroup(
    type: ProductType,
    lines: CartLine[],
    deliveryMethod: ShopDelivery,
    setting: Pick<ShopSetting, "shippingBaseFee" | "shippingExtraPerItem">
): GroupSummary {
    const quantity = lines.reduce((sum, l) => sum + l.quantity, 0)
    const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0)
    const fee = deliveryMethod === "SHIPPING" ? shippingFee(quantity, setting) : 0
    return { type, lines, quantity, subtotal, shippingFee: fee, total: subtotal + fee }
}

/** สรุปทุกออเดอร์ที่จะถูกสร้างจากตะกร้าใบนี้ */
export function summarizeCart(
    lines: CartLine[],
    deliveryMethod: ShopDelivery,
    setting: Pick<ShopSetting, "shippingBaseFee" | "shippingExtraPerItem">
) {
    const groups = groupByType(lines).map((g) => summarizeGroup(g.type, g.lines, deliveryMethod, setting))
    return {
        groups,
        quantity: groups.reduce((s, g) => s + g.quantity, 0),
        subtotal: groups.reduce((s, g) => s + g.subtotal, 0),
        shippingFee: groups.reduce((s, g) => s + g.shippingFee, 0),
        total: groups.reduce((s, g) => s + g.total, 0),
    }
}

/** วิธีรับของที่ "ทุกชิ้น" ในตะกร้ารองรับ — ถ้าชิ้นใดชิ้นหนึ่งไม่ให้ส่ง ก็ส่งทั้งตะกร้าไม่ได้ */
export function allowedDelivery(lines: CartLine[]) {
    return {
        pickup: lines.length > 0 && lines.every((l) => l.allowPickup),
        shipping: lines.length > 0 && lines.every((l) => l.allowShipping),
    }
}

/** จำนวนชิ้นรวมในตะกร้า — ใช้โชว์ตัวเลขบนไอคอนตะกร้า */
export async function cartCount(userId: string) {
    const rows = await prisma.cartItem.aggregate({
        where: { cart: { userId } },
        _sum: { quantity: true },
    })
    return rows._sum.quantity ?? 0
}

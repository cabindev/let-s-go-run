import type { OrderStatus, Prisma, ProductType } from "@prisma/client"

export const ORDER_STATUSES: OrderStatus[] = [
    "PENDING",
    "PAID",
    "PREPARING",
    "SHIPPED",
    "COMPLETED",
    "CANCELLED",
    "EXPIRED",
    "REFUNDED",
]

export const PRODUCT_TYPES: ProductType[] = ["STOCK", "PREORDER"]

/** ตัวกรองร่วมกันของหน้ารายการออเดอร์แอดมินและตัว export — กันสองที่เขียนตรรกะไม่ตรงกัน */
export function buildOrderWhere(params: {
    status?: string
    type?: string
    q?: string
}): Prisma.OrderWhereInput {
    const { status, type, q } = params
    const query = q?.trim()

    return {
        ...(ORDER_STATUSES.includes(status as OrderStatus) ? { status: status as OrderStatus } : {}),
        ...(PRODUCT_TYPES.includes(type as ProductType) ? { type: type as ProductType } : {}),
        ...(query
            ? {
                OR: [
                    { orderNo: { contains: query } },
                    { recipientName: { contains: query } },
                    { recipientPhone: { contains: query } },
                    { trackingNo: { contains: query } },
                    { user: { name: { contains: query } } },
                    { user: { email: { contains: query } } },
                ],
            }
            : {}),
    }
}

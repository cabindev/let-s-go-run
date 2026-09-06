import { Card } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { requireUser } from "@/lib/auth-helpers"
import { buildCartLines, getCart, groupByType } from "@/lib/cart"
import { getShopSetting, SHOP_NAME } from "@/lib/shop"
import { expireStaleOrders } from "@/lib/order-stock"
import { CartView } from "@/components/shop/CartView"
import { formatBaht } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: `ตะกร้าสินค้า · ${SHOP_NAME}` }

export default async function CartPage() {
    const user = await requireUser()

    // ปล่อยสต็อกที่ค้างจากออเดอร์หมดอายุก่อน เพื่อให้ "เหลือกี่ชิ้น" ที่เห็นตรงกับความจริง
    await expireStaleOrders()

    const [cart, setting] = await Promise.all([getCart(user.id), getShopSetting()])

    const lines = cart ? buildCartLines(cart) : []
    const groups = groupByType(lines).map((g) => ({
        type: g.type,
        lines: g.lines,
        quantity: g.lines.reduce((s, l) => s + l.quantity, 0),
        subtotal: g.lines.reduce((s, l) => s + l.lineTotal, 0),
    }))

    const hasIssue = lines.some((l) => l.issue)
    const shippingHint =
        `ยังไม่รวมค่าจัดส่ง — เลือกวิธีรับของในขั้นถัดไป (ส่งไปรษณีย์ ชิ้นแรก ${formatBaht(setting.shippingBaseFee)}` +
        ` ชิ้นถัดไปบวกชิ้นละ ${formatBaht(setting.shippingExtraPerItem)} · รับเองไม่มีค่าใช้จ่าย)`

    return (
        <div className="pt-4 max-w-2xl mx-auto space-y-8">
            <div>
                <p className="eyebrow">{SHOP_NAME}</p>
                <h1 className="display text-2xl sm:text-3xl mt-1.5">ตะกร้าสินค้า</h1>
            </div>

            {lines.length === 0 ? (
                <Card>
                    <EmptyState
                        title="ตะกร้ายังว่างอยู่"
                        description="เลือกสินค้าที่ต้องการแล้วกดใส่ตะกร้า"
                        actionLabel="ไปเลือกสินค้า"
                        actionHref="/shop"
                    />
                </Card>
            ) : (
                <CartView groups={groups} hasIssue={hasIssue} shippingHint={shippingHint} />
            )}
        </div>
    )
}

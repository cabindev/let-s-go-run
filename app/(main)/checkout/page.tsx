import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth-helpers"
import { Notice } from "@/components/ui/Badge"
import { CheckoutForm } from "@/components/shop/CheckoutForm"
import { allowedDelivery, buildCartLines, getCart, groupByType } from "@/lib/cart"
import { getShopSetting, ORDER_PAYMENT_WINDOW_HOURS, SHOP_NAME } from "@/lib/shop"
import { expireStaleOrders } from "@/lib/order-stock"

export const dynamic = "force-dynamic"
export const metadata = { title: `ยืนยันคำสั่งซื้อ · ${SHOP_NAME}` }

export default async function CheckoutPage() {
    const user = await requireUser()

    await expireStaleOrders()

    const [cart, setting, profile] = await Promise.all([
        getCart(user.id),
        getShopSetting(),
        prisma.user.findUnique({ where: { id: user.id }, select: { name: true, phone: true } }),
    ])

    const lines = cart ? buildCartLines(cart) : []
    if (lines.length === 0) redirect("/cart")

    // มีรายการที่สั่งไม่ได้ (ของหมด/ปิดขาย/จำนวนเกิน) ต้องกลับไปแก้ที่ตะกร้าก่อน
    if (lines.some((l) => l.issue)) redirect("/cart")

    const groups = groupByType(lines).map((g) => ({
        type: g.type,
        lines: g.lines,
        quantity: g.lines.reduce((s, l) => s + l.quantity, 0),
        subtotal: g.lines.reduce((s, l) => s + l.lineTotal, 0),
    }))

    const allowed = allowedDelivery(lines)

    return (
        <div className="pt-4 max-w-2xl mx-auto space-y-8">
            <Link
                href="/cart"
                className="inline-flex items-center gap-2 text-[15px] font-semibold text-ink-mute hover:text-ink transition-colors"
            >
                <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                กลับไปที่ตะกร้า
            </Link>

            <div>
                <p className="eyebrow">{SHOP_NAME}</p>
                <h1 className="display text-2xl sm:text-3xl mt-1.5">ยืนยันคำสั่งซื้อ</h1>
                <p className="text-ink-soft text-[15px] mt-2">
                    ตรวจสอบรายการและเลือกวิธีรับของ แล้วจึงชำระเงินในขั้นถัดไป
                </p>
            </div>

            <Notice tone="sky" title={`ต้องชำระเงินภายใน ${ORDER_PAYMENT_WINDOW_HOURS} ชั่วโมง`}>
                <p>
                    เมื่อยืนยันคำสั่งซื้อ ระบบจะกันสินค้าไว้ให้ทันที
                    ถ้าไม่ชำระเงินภายในเวลาที่กำหนด สินค้าจะถูกคืนเข้าสต็อกให้คนอื่นซื้อต่อโดยอัตโนมัติ
                </p>
            </Notice>

            <CheckoutForm
                groups={groups}
                allowPickup={allowed.pickup}
                allowShipping={allowed.shipping}
                shippingBaseFee={setting.shippingBaseFee}
                shippingExtraPerItem={setting.shippingExtraPerItem}
                pickupLocation={setting.pickupLocation}
                defaults={{ name: profile?.name ?? "", phone: profile?.phone ?? "" }}
            />
        </div>
    )
}

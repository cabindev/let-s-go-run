import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { getShopSetting, SHOP_NAME } from "@/lib/shop"
import { ShopSettingForm } from "@/components/admin/ShopSettingForm"

export const dynamic = "force-dynamic"

export default async function ShopSettingsPage() {
    const setting = await getShopSetting()

    return (
        <div className="max-w-2xl mx-auto space-y-12">
            <div>
                <Link
                    href="/admin/products"
                    className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                    สินค้า
                </Link>
                <h1 className="display text-2xl sm:text-3xl mt-4">ตั้งค่า{SHOP_NAME}</h1>
            </div>

            <ShopSettingForm setting={setting} />
        </div>
    )
}

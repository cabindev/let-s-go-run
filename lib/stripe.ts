import Stripe from "stripe"

declare global {
    var stripe: Stripe | undefined
}

/**
 * สร้าง Stripe client แบบ lazy (ตอนถูกเรียกใช้จริงครั้งแรก ไม่ใช่ตอน import ไฟล์นี้)
 * เพราะ `next build` ต้อง import ทุก API route (รวม /api/stripe/webhook) เพื่อเก็บข้อมูล route
 * แม้จะยังไม่มี STRIPE_SECRET_KEY จริงตอน build ก็ตาม (เช่น build บนเซิร์ฟเวอร์ deploy ที่ยังไม่ได้
 * ตั้งค่า env ให้ครบ) — ถ้า throw ตอน import จะทำให้ build พังไปด้วยทั้งที่ยังไม่มี request ใดๆ เข้ามาเลย
 */
function getStripeClient(): Stripe {
    if (global.stripe) return global.stripe

    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) throw new Error("STRIPE_SECRET_KEY ไม่ได้ตั้งค่าไว้ใน .env")

    global.stripe = new Stripe(secretKey)
    return global.stripe
}

export const stripe = new Proxy({} as Stripe, {
    get(_target, prop) {
        const client = getStripeClient()
        return Reflect.get(client, prop, client)
    },
})

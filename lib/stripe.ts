import Stripe from "stripe"

const secretKey = process.env.STRIPE_SECRET_KEY
if (!secretKey) throw new Error("STRIPE_SECRET_KEY ไม่ได้ตั้งค่าไว้ใน .env")

export const stripe = global.stripe || new Stripe(secretKey)

if (process.env.NODE_ENV === "development") global.stripe = stripe

declare global {
    var stripe: Stripe | undefined
}

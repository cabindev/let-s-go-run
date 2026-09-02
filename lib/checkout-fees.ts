export type PaymentMethodChoice = "card" | "promptpay"

/**
 * อัตราค่าธรรมเนียม Stripe ประเทศไทย ต่อวิธีจ่าย — ใช้คำนวณยอดที่ต้องบวกเพิ่มจากราคาสมัครจริง
 * เพื่อให้ผู้จัดงานได้รับเต็มยอดค่าสมัคร โดยผู้จ่ายเป็นคนรับภาระค่าธรรมเนียมแทน (แบบเดียวกับ regis.run)
 *
 * อ้างอิง https://stripe.com/en-th/pricing/local-payment-methods — ตัวเลขนี้คืออัตรา "บัตรในประเทศ"
 * บัตรต่างประเทศ/ที่ต้องแปลงสกุลเงินจะมีค่าธรรมเนียมจริงสูงกว่านี้เล็กน้อย ถือเป็นค่าประมาณการ
 */
const FEE_RATES: Record<PaymentMethodChoice, { percent: number; fixed: number }> = {
    card: { percent: 0.0365, fixed: 10 },
    promptpay: { percent: 0.0165, fixed: 0 },
}

export const FEE_LABEL: Record<PaymentMethodChoice, string> = {
    card: "Credit/Debit Card / บัตรเครดิต/เดบิต",
    promptpay: "PromptPay",
}

/** ยอดที่ต้องเรียกเก็บจริง (รวมค่าธรรมเนียม) ให้ผู้จัดงานได้รับเท่ากับ `amount` เป๊ะๆ หลัง Stripe หักค่าธรรมเนียมแล้ว */
export function amountWithFee(amount: number, method: PaymentMethodChoice) {
    const { percent, fixed } = FEE_RATES[method]
    return Math.ceil((amount + fixed) / (1 - percent))
}

/** ส่วนต่างค่าธรรมเนียมอย่างเดียว (สำหรับโชว์ในหน้าจ่ายเงิน) */
export function feeOnly(amount: number, method: PaymentMethodChoice) {
    return amountWithFee(amount, method) - amount
}

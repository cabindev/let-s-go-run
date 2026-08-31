import { randomBytes, createHash } from "crypto"

/** hash ของ token เก็บใน DB — token ดิบส่งไปในลิงก์อีเมลเท่านั้น เหมือนหลัก practice ของรหัสผ่าน */
export function hashResetToken(token: string) {
    return createHash("sha256").update(token).digest("hex")
}

export function generateResetToken() {
    const token = randomBytes(32).toString("hex")
    return { token, tokenHash: hashResetToken(token) }
}

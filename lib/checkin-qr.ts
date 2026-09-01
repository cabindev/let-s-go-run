import QRCode from "qrcode"

/**
 * QR code สำหรับสแกนรับเสื้อ/ของที่ระลึกหน้างาน — เข้ารหัสแค่ registrationId เป็นข้อความล้วน
 * ระบบสแกนแยกต่างหาก ("ludtong-checkin") อ่านค่านี้แล้วเรียก /api/checkin/[id] ต่อ
 */
export function generateCheckinQr(registrationId: string): Promise<string> {
    return QRCode.toDataURL(registrationId, { width: 240, margin: 1 })
}

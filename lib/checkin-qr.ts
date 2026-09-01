import QRCode from "qrcode"

/**
 * QR code สำหรับสแกนรับเสื้อ/ของที่ระลึกหน้างาน — เข้ารหัสแค่ registrationId เป็นข้อความล้วน
 * หน้า /admin/checkin (CheckBIB) อ่านค่านี้แล้วเรียก server action ต่อ
 */
export function generateCheckinQr(registrationId: string): Promise<string> {
    return QRCode.toDataURL(registrationId, { width: 240, margin: 1 })
}

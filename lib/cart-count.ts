import { getSession } from "@/lib/auth-helpers"
import { cartCount } from "@/lib/cart"

/**
 * จำนวนชิ้นในตะกร้าของผู้ใช้ที่ล็อกอินอยู่ (0 ถ้ายังไม่ล็อกอิน)
 *
 * เรียกจาก layout ฝั่ง server เพื่อส่งลงไปให้แถบนำทาง — ตัวเลขจึงตรงกับฐานข้อมูลเสมอ
 * ไม่ต้องมี state ฝั่ง client ให้หลุดจากความจริง (หน้าเหล่านี้เป็น force-dynamic อยู่แล้ว)
 */
export async function currentCartCount() {
    const session = await getSession()
    if (!session?.user) return 0
    try {
        return await cartCount(session.user.id)
    } catch {
        // ตะกร้าพังไม่ควรทำให้ทั้งหน้าพัง — แค่ไม่โชว์ตัวเลข
        return 0
    }
}

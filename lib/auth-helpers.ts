import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import authOptions from "@/lib/configs/auth/authOptions"

/** session ปัจจุบัน (อาจเป็น null) */
export async function getSession() {
    return getServerSession(authOptions)
}

/** ต้องล็อกอิน — ใช้ในหน้า (page/layout) เท่านั้น เพราะมี redirect */
export async function requireUser() {
    const session = await getSession()
    if (!session?.user) redirect("/auth/signin")
    return session.user
}

/** ต้องเป็นแอดมิน — ใช้ในหน้า */
export async function requireAdminPage() {
    const session = await getSession()
    if (!session?.user) redirect("/auth/signin")
    if (session.user.role !== "ADMIN") redirect("/")
    return session.user
}

/** ต้องล็อกอิน — ใช้ใน server action (โยน error แทน redirect) */
export async function requireUserAction() {
    const session = await getSession()
    if (!session?.user) throw new Error("กรุณาเข้าสู่ระบบ")
    return session.user
}

/** ต้องเป็นแอดมิน — ใช้ใน server action */
export async function requireAdminAction() {
    const session = await getSession()
    if (session?.user?.role !== "ADMIN") throw new Error("ไม่มีสิทธิ์เข้าถึง")
    return session.user
}

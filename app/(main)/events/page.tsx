import { redirect } from "next/navigation"

/** รายการงานวิ่งย้ายไปอยู่หน้าแรกแล้ว — คงเส้นทางเดิมไว้ให้ลิงก์เก่ายังใช้ได้ */
export default async function EventsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const sp = await searchParams
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) {
        if (typeof v === "string") params.set(k, v)
    }
    const qs = params.toString()
    redirect(qs ? `/?${qs}` : "/")
}

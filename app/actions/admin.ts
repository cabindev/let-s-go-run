'use server'

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAdminAction } from "@/lib/auth-helpers"
import { saveImage } from "@/lib/upload"
import { IMAGE_GROUPS, groupField } from "@/lib/image-groups"
import type { ImageCategory } from "@prisma/client"
import { recalculateUserStats } from "@/lib/stats"
import type { ActionResult } from "./registration"

const eventSchema = z.object({
    title: z.string().trim().min(1, "กรุณากรอกชื่อกิจกรรม").max(150),
    description: z.string().trim().min(1, "กรุณากรอกรายละเอียด"),
    date: z.string().min(1, "กรุณาเลือกวันและเวลาเริ่ม"),
    endDate: z.string().optional().or(z.literal("")),
    location: z.string().trim().min(1, "กรุณากรอกสถานที่"),
    province: z.string().trim().optional().or(z.literal("")),
    organizer: z.string().trim().max(150).optional().or(z.literal("")),
    type: z.enum(["ONSITE", "VIRTUAL"]),
    registerOpenAt: z.string().optional().or(z.literal("")),
    registerCloseAt: z.string().optional().or(z.literal("")),
    distance: z.coerce.number().min(0).optional(),
    price: z.coerce.number().min(0).optional(),
    maxParticipants: z.string().optional().or(z.literal("")),
    status: z.enum(["OPEN", "CLOSED", "CANCELLED"]),
    rewards: z.string().trim().max(2000).optional().or(z.literal("")),
    contactUrl: z.string().trim().url("ลิงก์ติดต่อไม่ถูกต้อง").optional().or(z.literal("")),
    announceAt: z.string().optional().or(z.literal("")),
    pdpaNotice: z.string().trim().max(5000).optional().or(z.literal("")),
})

export interface ParsedCategory {
    name: string
    distance: number
    price: number
    maxSlots: number | null
}

/**
 * อ่านแถว "ระยะและค่าสมัคร" จากฟอร์ม — ทุกแถวส่งชื่อ field เดียวกัน จับคู่ตามลำดับ
 * คืน error ถ้ากรอกไม่ครบหรือค่าไม่ถูกต้อง
 */
function parseCategories(formData: FormData): { ok: true; rows: ParsedCategory[] } | { ok: false; error: string } {
    const names = formData.getAll("cat.name").map(String)
    const distances = formData.getAll("cat.distance").map(String)
    const prices = formData.getAll("cat.price").map(String)
    const slots = formData.getAll("cat.maxSlots").map(String)

    if (names.length === 0) return { ok: false, error: "กรุณาเพิ่มระยะอย่างน้อย 1 รายการ" }

    const rows: ParsedCategory[] = []
    for (let i = 0; i < names.length; i++) {
        const name = names[i]?.trim()
        const distance = Number(distances[i])
        const price = Number(prices[i])
        const maxSlots = slots[i]?.trim() ? Number(slots[i]) : null

        if (!name) return { ok: false, error: `ระยะที่ ${i + 1}: กรุณากรอกชื่อระยะ` }
        if (!Number.isFinite(distance) || distance < 0) return { ok: false, error: `ระยะที่ ${i + 1}: ระยะทางไม่ถูกต้อง` }
        if (!Number.isFinite(price) || price < 0) return { ok: false, error: `ระยะที่ ${i + 1}: ค่าสมัครไม่ถูกต้อง` }
        if (maxSlots !== null && (!Number.isFinite(maxSlots) || maxSlots < 1)) {
            return { ok: false, error: `ระยะที่ ${i + 1}: จำนวนที่รับไม่ถูกต้อง` }
        }

        rows.push({ name, distance, price, maxSlots })
    }
    return { ok: true, rows }
}

/** บันทึกรูปของหมวดเดียว คืนจำนวนที่บันทึกสำเร็จ */
async function saveGroup(
    eventId: string,
    category: ImageCategory,
    files: FormDataEntryValue[],
    startOrder: number
) {
    const images = files.filter((f): f is File => f instanceof File && f.size > 0)
    if (images.length === 0) return 0

    const saved = []
    for (const file of images) saved.push(await saveImage(file, "events"))

    await prisma.eventImage.createMany({
        data: saved.map((s, i) => ({
            eventId,
            url: s.url,
            width: s.width ?? null,
            height: s.height ?? null,
            category,
            sortOrder: startOrder + i,
        })),
    })
    return saved.length
}

/** บันทึกรูปประกอบจากทุกหมวดในฟอร์มเดียว */
async function saveGallery(eventId: string, formData: FormData) {
    let total = 0
    for (const g of IMAGE_GROUPS) {
        const existing = await prisma.eventImage.count({ where: { eventId, category: g.key } })
        total += await saveGroup(eventId, g.key, formData.getAll(groupField(g.key)), existing)
    }
    return total
}

function parseEventForm(formData: FormData) {
    return eventSchema.safeParse({
        title: formData.get("title"),
        description: formData.get("description"),
        date: formData.get("date"),
        endDate: formData.get("endDate"),
        location: formData.get("location"),
        province: formData.get("province"),
        organizer: formData.get("organizer"),
        type: formData.get("type"),
        registerOpenAt: formData.get("registerOpenAt"),
        registerCloseAt: formData.get("registerCloseAt"),
        distance: formData.get("distance"),
        price: formData.get("price"),
        maxParticipants: formData.get("maxParticipants"),
        status: formData.get("status"),
        rewards: formData.get("rewards"),
        contactUrl: formData.get("contactUrl"),
        announceAt: formData.get("announceAt"),
        pdpaNotice: formData.get("pdpaNotice"),
    })
}

export async function createEvent(formData: FormData): Promise<ActionResult> {
    try {
        await requireAdminAction()
        const parsed = parseEventForm(formData)
        if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

        const d = parsed.data
        const start = new Date(d.date)
        const end = d.endDate ? new Date(d.endDate) : null
        if (end && end <= start) return { ok: false, error: "เวลาสิ้นสุดต้องหลังเวลาเริ่ม" }
        // งานสะสมระยะต้องมีช่วงเวลา ไม่งั้นระบบจะถือว่าจบวันเดียวกับวันเริ่ม
        if (d.type === "VIRTUAL" && !end) {
            return { ok: false, error: "งานสะสมระยะต้องระบุวันสุดท้ายที่ส่งผลได้" }
        }

        const parsedCats = parseCategories(formData)
        if (!parsedCats.ok) return { ok: false, error: parsedCats.error }
        const cats = parsedCats.rows

        const collectGender = formData.get("collectGender") === "on"
        const collectBloodType = formData.get("collectBloodType") === "on"
        const collectNationalId = formData.get("collectNationalId") === "on"
        const collectPreviousParticipation = formData.get("collectPreviousParticipation") === "on"

        let image: string | null = null
        const file = formData.get("image")
        if (file instanceof File && file.size > 0) image = (await saveImage(file, "events")).url

        const event = await prisma.event.create({
            data: {
                title: d.title,
                description: d.description,
                date: start,
                endDate: end,
                location: d.location,
                province: d.province || null,
                organizer: d.organizer || null,
                type: d.type,
                registerOpenAt: d.registerOpenAt ? new Date(d.registerOpenAt) : null,
                registerCloseAt: d.registerCloseAt ? new Date(d.registerCloseAt) : null,
                // ค่าหัวเรื่องของงาน คำนวณจากระยะที่ใส่ไว้ — ระยะไกลสุด และราคาเริ่มต้น
                distance: Math.max(...cats.map((c) => c.distance)),
                price: Math.min(...cats.map((c) => c.price)),
                maxParticipants: d.maxParticipants ? Number(d.maxParticipants) : null,
                status: d.status,
                rewards: d.rewards || null,
                contactUrl: d.contactUrl || null,
                announceAt: d.announceAt ? new Date(d.announceAt) : null,
                collectGender,
                collectBloodType,
                collectNationalId,
                collectPreviousParticipation,
                pdpaNotice: d.pdpaNotice || null,
                image,
                categories: {
                    create: cats.map((c, i) => ({
                        name: c.name,
                        distance: c.distance,
                        price: c.price,
                        maxSlots: c.maxSlots,
                        sortOrder: i,
                    })),
                },
            },
        })

        // รูปประกอบ แยกตามหมวด (เสื้อ / เหรียญ / เส้นทาง ฯลฯ)
        await saveGallery(event.id, formData)

        revalidatePath("/admin/events")
        revalidatePath("/events")
        revalidatePath("/")
        return { ok: true, message: event.id }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "สร้างกิจกรรมไม่สำเร็จ" }
    }
}

export async function updateEvent(id: string, formData: FormData): Promise<ActionResult> {
    try {
        await requireAdminAction()
        const parsed = parseEventForm(formData)
        if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

        const d = parsed.data
        const start = new Date(d.date)
        const end = d.endDate ? new Date(d.endDate) : null
        if (end && end <= start) return { ok: false, error: "เวลาสิ้นสุดต้องหลังเวลาเริ่ม" }
        // งานสะสมระยะต้องมีช่วงเวลา ไม่งั้นระบบจะถือว่าจบวันเดียวกับวันเริ่ม
        if (d.type === "VIRTUAL" && !end) {
            return { ok: false, error: "งานสะสมระยะต้องระบุวันสุดท้ายที่ส่งผลได้" }
        }

        // ค่าหัวเรื่องยึดตามประเภทที่มีอยู่ ถ้ายังไม่มีให้ใช้ค่าที่ส่งมา
        const existing = await prisma.raceCategory.findMany({
            where: { eventId: id },
            select: { distance: true, price: true },
        })
        const headline = existing.length
            ? {
                distance: Math.max(...existing.map((c) => c.distance)),
                price: Math.min(...existing.map((c) => c.price)),
            }
            : { distance: d.distance ?? 0, price: d.price ?? 0 }

        const collectGender = formData.get("collectGender") === "on"
        const collectBloodType = formData.get("collectBloodType") === "on"
        const collectNationalId = formData.get("collectNationalId") === "on"
        const collectPreviousParticipation = formData.get("collectPreviousParticipation") === "on"

        let image: string | undefined
        const file = formData.get("image")
        if (file instanceof File && file.size > 0) image = (await saveImage(file, "events")).url

        await prisma.event.update({
            where: { id },
            data: {
                title: d.title,
                description: d.description,
                date: start,
                endDate: end,
                location: d.location,
                province: d.province || null,
                organizer: d.organizer || null,
                type: d.type,
                registerOpenAt: d.registerOpenAt ? new Date(d.registerOpenAt) : null,
                registerCloseAt: d.registerCloseAt ? new Date(d.registerCloseAt) : null,
                distance: headline.distance,
                price: headline.price,
                maxParticipants: d.maxParticipants ? Number(d.maxParticipants) : null,
                status: d.status,
                rewards: d.rewards || null,
                contactUrl: d.contactUrl || null,
                announceAt: d.announceAt ? new Date(d.announceAt) : null,
                collectGender,
                collectBloodType,
                collectNationalId,
                collectPreviousParticipation,
                pdpaNotice: d.pdpaNotice || null,
                ...(image ? { image } : {}),
            },
        })

        revalidatePath("/admin/events")
        revalidatePath(`/admin/events/${id}/edit`)
        revalidatePath(`/events/${id}`)
        revalidatePath("/events")
        revalidatePath("/")
        return { ok: true, message: "บันทึกกิจกรรมแล้ว" }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" }
    }
}

export async function deleteEvent(id: string): Promise<ActionResult> {
    try {
        await requireAdminAction()

        const affected = await prisma.registration.findMany({
            where: { eventId: id, status: "PAID" },
            select: { userId: true },
        })

        await prisma.event.delete({ where: { id } })

        // ผู้ที่เคยจ่ายกิจกรรมนี้ ต้องคำนวณระยะทางสะสมใหม่
        for (const userId of new Set(affected.map((a) => a.userId))) {
            await recalculateUserStats(userId)
        }

        revalidatePath("/admin/events")
        revalidatePath("/events")
        revalidatePath("/")
        return { ok: true, message: "ลบกิจกรรมแล้ว" }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "ลบไม่สำเร็จ" }
    }
}

export async function setUserRole(userId: string, role: "USER" | "ADMIN"): Promise<ActionResult> {
    try {
        const admin = await requireAdminAction()
        if (admin.id === userId) return { ok: false, error: "เปลี่ยนสิทธิ์ของตัวเองไม่ได้" }

        await prisma.user.update({ where: { id: userId }, data: { role } })
        revalidatePath("/admin/users")
        return { ok: true, message: "เปลี่ยนสิทธิ์แล้ว" }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "เปลี่ยนสิทธิ์ไม่สำเร็จ" }
    }
}

const achievementSchema = z.object({
    name: z.string().trim().min(1, "กรุณากรอกชื่อ").max(80),
    description: z.string().trim().max(200).optional().or(z.literal("")),
    icon: z.string().trim().max(8).optional().or(z.literal("")),
    type: z.enum(["EVENT_COUNT", "TOTAL_DISTANCE"]),
    threshold: z.coerce.number().min(0.1, "เกณฑ์ต้องมากกว่า 0"),
})

export async function createAchievement(formData: FormData): Promise<ActionResult> {
    try {
        await requireAdminAction()
        const parsed = achievementSchema.safeParse({
            name: formData.get("name"),
            description: formData.get("description"),
            icon: formData.get("icon"),
            type: formData.get("type"),
            threshold: formData.get("threshold"),
        })
        if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

        await prisma.achievement.create({
            data: {
                name: parsed.data.name,
                description: parsed.data.description || null,
                icon: parsed.data.icon || "🏅",
                type: parsed.data.type,
                threshold: parsed.data.threshold,
            },
        })

        revalidatePath("/admin/achievements")
        return { ok: true, message: "เพิ่มความสำเร็จแล้ว" }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "เพิ่มไม่สำเร็จ" }
    }
}

export async function deleteAchievement(id: string): Promise<ActionResult> {
    try {
        await requireAdminAction()
        await prisma.achievement.delete({ where: { id } })
        revalidatePath("/admin/achievements")
        return { ok: true, message: "ลบแล้ว" }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "ลบไม่สำเร็จ" }
    }
}

// ───────────── ประเภทการแข่งขัน ─────────────

/**
 * ปรับค่าหัวเรื่องของงาน (ระยะไกลสุด / ราคาเริ่มต้น) ให้ตรงกับประเภทที่มีอยู่จริง
 * เรียกทุกครั้งที่ประเภทเปลี่ยน เพื่อให้การ์ดในหน้าแรกแสดงตัวเลขถูกต้อง
 */
async function syncEventHeadline(eventId: string) {
    const cats = await prisma.raceCategory.findMany({
        where: { eventId },
        select: { distance: true, price: true },
    })
    if (cats.length === 0) return

    await prisma.event.update({
        where: { id: eventId },
        data: {
            distance: Math.max(...cats.map((c) => c.distance)),
            price: Math.min(...cats.map((c) => c.price)),
        },
    })
}

const categorySchema = z.object({
    eventId: z.string().min(1),
    name: z.string().trim().min(1, "กรุณากรอกชื่อประเภท").max(100),
    distance: z.coerce.number().min(0, "ระยะทางต้องไม่ติดลบ"),
    price: z.coerce.number().min(0, "ราคาต้องไม่ติดลบ"),
    maxSlots: z.string().optional().or(z.literal("")),
})

export async function createCategory(formData: FormData): Promise<ActionResult> {
    try {
        await requireAdminAction()
        const parsed = categorySchema.safeParse({
            eventId: formData.get("eventId"),
            name: formData.get("name"),
            distance: formData.get("distance"),
            price: formData.get("price"),
            maxSlots: formData.get("maxSlots"),
        })
        if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
        const d = parsed.data

        const count = await prisma.raceCategory.count({ where: { eventId: d.eventId } })

        await prisma.raceCategory.create({
            data: {
                eventId: d.eventId,
                name: d.name,
                distance: d.distance,
                price: d.price,
                maxSlots: d.maxSlots ? Number(d.maxSlots) : null,
                sortOrder: count,
            },
        })

        await syncEventHeadline(d.eventId)

        revalidatePath(`/admin/events/${d.eventId}/edit`)
        revalidatePath(`/events/${d.eventId}`)
        revalidatePath(`/virtual/${d.eventId}`)
        revalidatePath("/")
        return { ok: true, message: "เพิ่มประเภทแล้ว" }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "เพิ่มไม่สำเร็จ" }
    }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
    try {
        await requireAdminAction()

        const category = await prisma.raceCategory.findUnique({
            where: { id },
            select: { eventId: true, _count: { select: { registrations: true } } },
        })
        if (!category) return { ok: false, error: "ไม่พบประเภทนี้" }
        if (category._count.registrations > 0) {
            return { ok: false, error: `มีผู้สมัครประเภทนี้ ${category._count.registrations} คน ลบไม่ได้` }
        }

        await prisma.raceCategory.delete({ where: { id } })
        await syncEventHeadline(category.eventId)

        revalidatePath(`/admin/events/${category.eventId}/edit`)
        revalidatePath(`/events/${category.eventId}`)
        revalidatePath(`/virtual/${category.eventId}`)
        revalidatePath("/")
        return { ok: true, message: "ลบประเภทแล้ว" }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "ลบไม่สำเร็จ" }
    }
}

// ───────────── รูปประกอบของงาน ─────────────

/** เพิ่มรูปประกอบเข้ากับงานที่มีอยู่แล้ว (รับได้ทีละหมวดหรือหลายหมวดพร้อมกัน) */
export async function addEventImages(eventId: string, formData: FormData): Promise<ActionResult> {
    try {
        await requireAdminAction()

        const added = await saveGallery(eventId, formData)
        if (added === 0) return { ok: false, error: "กรุณาเลือกรูปอย่างน้อย 1 รูป" }

        revalidatePath(`/admin/events/${eventId}/edit`)
        revalidatePath(`/events/${eventId}`)
        return { ok: true, message: `เพิ่มรูปแล้ว ${added} รูป` }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ" }
    }
}

export async function deleteEventImage(id: string): Promise<ActionResult> {
    try {
        await requireAdminAction()
        const img = await prisma.eventImage.delete({ where: { id }, select: { eventId: true } })
        revalidatePath(`/admin/events/${img.eventId}/edit`)
        revalidatePath(`/events/${img.eventId}`)
        return { ok: true, message: "ลบรูปแล้ว" }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "ลบไม่สำเร็จ" }
    }
}

/** เลื่อนลำดับรูปขึ้น/ลง */
export async function moveEventImage(id: string, direction: "up" | "down"): Promise<ActionResult> {
    try {
        await requireAdminAction()

        const current = await prisma.eventImage.findUnique({ where: { id } })
        if (!current) return { ok: false, error: "ไม่พบรูปนี้" }

        // สลับกับรูปข้างเคียง "ในหมวดเดียวกัน" เท่านั้น
        const neighbour = await prisma.eventImage.findFirst({
            where: {
                eventId: current.eventId,
                category: current.category,
                sortOrder: direction === "up" ? { lt: current.sortOrder } : { gt: current.sortOrder },
            },
            orderBy: { sortOrder: direction === "up" ? "desc" : "asc" },
        })
        if (!neighbour) return { ok: true } // อยู่หัว/ท้ายแล้ว

        await prisma.$transaction([
            prisma.eventImage.update({ where: { id: current.id }, data: { sortOrder: neighbour.sortOrder } }),
            prisma.eventImage.update({ where: { id: neighbour.id }, data: { sortOrder: current.sortOrder } }),
        ])

        revalidatePath(`/admin/events/${current.eventId}/edit`)
        revalidatePath(`/events/${current.eventId}`)
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "เลื่อนลำดับไม่สำเร็จ" }
    }
}

// ───────────── รายการลงทะเบียน ─────────────

/**
 * ยกเลิกรายการลงทะเบียนโดยผู้ดูแลระบบ — ใช้กับรายการที่ค้างจ่ายจนเกินกำหนด
 * คืนที่นั่งให้คนอื่น และคำนวณระยะทางสะสมของผู้ใช้ใหม่เผื่อเคยยืนยันไปแล้ว
 */
export async function cancelRegistrationAsAdmin(id: string): Promise<ActionResult> {
    try {
        await requireAdminAction()

        const reg = await prisma.registration.findUnique({
            where: { id },
            select: { userId: true, eventId: true, status: true },
        })
        if (!reg) return { ok: false, error: "ไม่พบรายการลงทะเบียน" }
        if (reg.status === "CANCELLED") return { ok: false, error: "รายการนี้ถูกยกเลิกไปแล้ว" }

        await prisma.registration.update({
            where: { id },
            data: { status: "CANCELLED" },
        })
        await recalculateUserStats(reg.userId)

        revalidatePath("/admin/registrations")
        revalidatePath("/admin")
        revalidatePath(`/events/${reg.eventId}`)
        revalidatePath(`/virtual/${reg.eventId}`)
        revalidatePath("/profile")
        return { ok: true, message: "ยกเลิกรายการแล้ว" }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "ยกเลิกไม่สำเร็จ" }
    }
}

// ───────────── เช็คอินรับเสื้อหน้างาน (สแกน QR ด้วยมือถือ) ─────────────

export interface CheckinInfo {
    id: string
    fullName: string | null
    bib: string | null
    shirtSize: string | null
    registrationStatus: string
    eventTitle: string
    categoryName: string | null
    pickupStatus: string
    pickupAt: string | null
    shippingTrackingNo: string | null
}

function serializeCheckin(reg: {
    id: string
    fullName: string | null
    bib: string | null
    shirtSize: string | null
    status: string
    pickupStatus: string
    pickupAt: Date | null
    shippingTrackingNo: string | null
    event: { title: string }
    category: { name: string; distance: number } | null
}): CheckinInfo {
    return {
        id: reg.id,
        fullName: reg.fullName,
        bib: reg.bib,
        shirtSize: reg.shirtSize,
        registrationStatus: reg.status,
        eventTitle: reg.event.title,
        categoryName: reg.category ? `${reg.category.name} (${reg.category.distance} กม.)` : null,
        pickupStatus: reg.pickupStatus,
        pickupAt: reg.pickupAt?.toISOString() ?? null,
        shippingTrackingNo: reg.shippingTrackingNo,
    }
}

/** ดึงข้อมูลผู้สมัครจาก registrationId ที่สแกน QR ได้ — ใช้ในหน้า /admin/checkin */
export async function lookupRegistrationForCheckin(
    registrationId: string
): Promise<{ ok: true; data: CheckinInfo } | { ok: false; error: string }> {
    try {
        await requireAdminAction()

        const reg = await prisma.registration.findUnique({
            where: { id: registrationId },
            include: { event: { select: { title: true } }, category: { select: { name: true, distance: true } } },
        })
        if (!reg) return { ok: false, error: "ไม่พบรายการลงทะเบียนนี้ — QR อาจไม่ถูกต้อง" }

        return { ok: true, data: serializeCheckin(reg) }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "ค้นหาไม่สำเร็จ" }
    }
}

/**
 * ยืนยันรับเสื้อที่บูธ (พร้อมลายเซ็นนิ้วเป็นหลักฐาน) หรือบันทึกว่าส่งไปรษณีย์แทน
 * formData: registrationId, method ("PICKED_UP" | "SHIPPED"), trackingNo?, signature? (ไฟล์รูป PNG จาก canvas)
 */
export async function confirmPickupAdmin(
    formData: FormData
): Promise<{ ok: true; data: CheckinInfo } | { ok: false; error: string }> {
    try {
        await requireAdminAction()

        const registrationId = String(formData.get("registrationId") ?? "")
        const method = formData.get("method")
        if (method !== "PICKED_UP" && method !== "SHIPPED") {
            return { ok: false, error: "method ต้องเป็น PICKED_UP หรือ SHIPPED" }
        }

        const reg = await prisma.registration.findUnique({ where: { id: registrationId }, select: { status: true } })
        if (!reg) return { ok: false, error: "ไม่พบรายการลงทะเบียนนี้" }
        if (reg.status !== "PAID") return { ok: false, error: "รายการนี้ยังไม่ยืนยันการชำระเงิน" }

        let signatureUrl: string | null = null
        const signatureFile = formData.get("signature")
        if (method === "PICKED_UP" && signatureFile instanceof File && signatureFile.size > 0) {
            signatureUrl = (await saveImage(signatureFile, "signatures")).url
        }

        const updated = await prisma.registration.update({
            where: { id: registrationId },
            data: {
                pickupStatus: method,
                pickupAt: new Date(),
                shippingTrackingNo: method === "SHIPPED" ? (String(formData.get("trackingNo") ?? "").trim() || null) : null,
                pickupSignatureUrl: method === "PICKED_UP" ? signatureUrl : null,
            },
            include: { event: { select: { title: true } }, category: { select: { name: true, distance: true } } },
        })

        revalidatePath("/admin/registrations")
        return { ok: true, data: serializeCheckin(updated) }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" }
    }
}

import type { Event, RaceCategory } from "@prisma/client"

/** ประเภทการแข่งขันที่ใช้จริง — ถ้างานยังไม่ได้สร้างประเภท ให้ใช้ค่าของงานเป็นประเภทเดียว */
export interface Option {
    id: string | null
    name: string
    distance: number
    price: number
    maxSlots: number | null
}

export function toOptions(event: Event, categories: RaceCategory[]): Option[] {
    if (categories.length > 0) {
        return categories.map((c) => ({
            id: c.id,
            name: c.name,
            distance: c.distance,
            price: c.price,
            maxSlots: c.maxSlots,
        }))
    }
    return [
        {
            id: null,
            name: `ระยะ ${event.distance} กม.`,
            distance: event.distance,
            price: event.price,
            maxSlots: event.maxParticipants,
        },
    ]
}

/** ราคาต่ำสุด–สูงสุดของงาน ใช้แสดงบนการ์ด */
export function priceRange(event: Event, categories: RaceCategory[]) {
    const prices = toOptions(event, categories).map((o) => o.price)
    return { min: Math.min(...prices), max: Math.max(...prices) }
}

/** ระยะทางทั้งหมดที่งานนี้มี เรียงจากน้อยไปมาก */
export function distances(event: Event, categories: RaceCategory[]) {
    return [...new Set(toOptions(event, categories).map((o) => o.distance))].sort((a, b) => a - b)
}

/** ระยะไกลสุดของงาน — ใช้เป็นตัวเลขแทนภาพปกเมื่อยังไม่มีรูป */
export function headlineDistance(event: Event, categories: RaceCategory[]) {
    return Math.max(...distances(event, categories))
}

export type RegisterState =
    | { open: true }
    | { open: false; reason: string }

/**
 * ตรวจว่างานนี้เปิดรับสมัครอยู่หรือไม่ พร้อมเหตุผลถ้าไม่เปิด
 *
 * ONSITE  : `date` คือวันแข่ง — พ้นวันนั้นถือว่าจบ
 * VIRTUAL : `date` คือวันเริ่มสะสมระยะ และ `endDate` คือวันสิ้นสุด
 *           สมัครได้จนถึงวันสิ้นสุด แม้วันเริ่มจะผ่านไปแล้ว
 */
export function registerState(event: Event, joined: number, now = new Date()): RegisterState {
    if (event.status === "CANCELLED") return { open: false, reason: "กิจกรรมนี้ถูกยกเลิก" }
    if (event.status === "CLOSED") return { open: false, reason: "ปิดรับสมัครแล้ว" }

    const lastDay = event.type === "VIRTUAL" ? (event.endDate ?? event.date) : event.date
    if (lastDay < now) {
        return { open: false, reason: event.type === "VIRTUAL" ? "กิจกรรมนี้สิ้นสุดแล้ว" : "กิจกรรมนี้จัดไปแล้ว" }
    }
    if (event.registerOpenAt && now < event.registerOpenAt) {
        return { open: false, reason: "ยังไม่ถึงเวลาเปิดรับสมัคร" }
    }
    if (event.registerCloseAt && now > event.registerCloseAt) {
        return { open: false, reason: "หมดเวลารับสมัครแล้ว" }
    }
    if (event.maxParticipants && joined >= event.maxParticipants) {
        return { open: false, reason: "จำนวนผู้สมัครเต็มแล้ว" }
    }
    return { open: true }
}

/**
 * วันสุดท้ายของงาน
 * ONSITE  = วันแข่ง
 * VIRTUAL = วันสิ้นสุดการสะสมระยะ
 */
export function lastDayOf(event: { date: Date; endDate?: Date | null; type: "ONSITE" | "VIRTUAL" }) {
    return event.type === "VIRTUAL" ? (event.endDate ?? event.date) : event.date
}

/** งานจบไปแล้วหรือยัง */
export function isEventOver(event: { date: Date; endDate?: Date | null; type: "ONSITE" | "VIRTUAL" }, now = new Date()) {
    return lastDayOf(event) < now
}

/** เส้นทางของหน้างาน — วิ่งในงานกับวิ่งสะสมระยะแยก URL กัน */
export function eventHref(event: { id: string; type: "ONSITE" | "VIRTUAL" }) {
    return event.type === "VIRTUAL" ? `/virtual/${event.id}` : `/events/${event.id}`
}

export const EVENT_TYPE_LABEL = {
    ONSITE: "Run",
    VIRTUAL: "VR Run",
} as const

export const SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"] as const

/** จังหวัดทั้งหมด สำหรับ dropdown ค้นหา */
export const PROVINCES = [
    "กรุงเทพมหานคร", "กระบี่", "กาญจนบุรี", "กาฬสินธุ์", "กำแพงเพชร", "ขอนแก่น", "จันทบุรี", "ฉะเชิงเทรา",
    "ชลบุรี", "ชัยนาท", "ชัยภูมิ", "ชุมพร", "เชียงราย", "เชียงใหม่", "ตรัง", "ตราด", "ตาก", "นครนายก",
    "นครปฐม", "นครพนม", "นครราชสีมา", "นครศรีธรรมราช", "นครสวรรค์", "นนทบุรี", "นราธิวาส", "น่าน",
    "บึงกาฬ", "บุรีรัมย์", "ปทุมธานี", "ประจวบคีรีขันธ์", "ปราจีนบุรี", "ปัตตานี", "พระนครศรีอยุธยา",
    "พะเยา", "พังงา", "พัทลุง", "พิจิตร", "พิษณุโลก", "เพชรบุรี", "เพชรบูรณ์", "แพร่", "ภูเก็ต",
    "มหาสารคาม", "มุกดาหาร", "แม่ฮ่องสอน", "ยโสธร", "ยะลา", "ร้อยเอ็ด", "ระนอง", "ระยอง", "ราชบุรี",
    "ลพบุรี", "ลำปาง", "ลำพูน", "เลย", "ศรีสะเกษ", "สกลนคร", "สงขลา", "สตูล", "สมุทรปราการ",
    "สมุทรสงคราม", "สมุทรสาคร", "สระแก้ว", "สระบุรี", "สิงห์บุรี", "สุโขทัย", "สุพรรณบุรี",
    "สุราษฎร์ธานี", "สุรินทร์", "หนองคาย", "หนองบัวลำภู", "อ่างทอง", "อำนาจเจริญ", "อุดรธานี",
    "อุตรดิตถ์", "อุทัยธานี", "อุบลราชธานี",
] as const

/**
 * ช่วงระยะทางสำหรับกรอง — ขอบเขตรวมปลายช่วงทั้งสองด้าน (gte/lte)
 * เพื่อให้ระยะมาตรฐาน 5 / 10 / 21 / 42 กม. ตกอยู่ในช่วงที่ผู้ใช้คาดหวัง
 */
export const DISTANCE_BANDS = [
    { key: "0-5", label: "ไม่เกิน 5 กม.", min: 0, max: 5 },
    { key: "5-10", label: "5 – 10 กม.", min: 5, max: 10 },
    { key: "10-21", label: "10 – 21 กม. (ฮาล์ฟ)", min: 10, max: 21 },
    { key: "21-42", label: "21 – 42 กม. (มาราธอน)", min: 21, max: 42 },
    { key: "42+", label: "มากกว่า 42 กม.", min: 42, max: 99999 },
] as const

import { writeFile, mkdir } from "fs/promises"
import { join, extname } from "path"
import { randomUUID } from "crypto"
import { readImageSize, type Size } from "./image-size"

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export interface SavedImage extends Partial<Size> {
    url: string
}

/**
 * บันทึกไฟล์รูปลง public/uploads/<folder> แล้วคืน URL พร้อมขนาดจริง
 * ตั้งชื่อไฟล์ใหม่เองทั้งหมด เพื่อไม่ให้ชื่อจากผู้ใช้หลุดไปถึง path
 */
export async function saveImage(
    file: File,
    folder: "slips" | "events" | "avatars" | "results"
): Promise<SavedImage> {
    if (!ALLOWED.has(file.type)) {
        throw new Error("รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WEBP หรือ GIF")
    }
    if (file.size > MAX_SIZE) {
        throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 5MB")
    }

    const ext = ({ "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" } as const)[
        file.type as "image/jpeg"
    ] ?? extname(file.name).toLowerCase()

    const dir = join(process.cwd(), "public", "uploads", folder)
    await mkdir(dir, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    const filename = `${Date.now()}-${randomUUID()}${ext}`
    await writeFile(join(dir, filename), buffer)

    const size = readImageSize(buffer)
    return { url: `/uploads/${folder}/${filename}`, ...(size ?? {}) }
}

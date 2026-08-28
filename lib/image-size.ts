/**
 * อ่านความกว้าง/สูงจากส่วนหัวของไฟล์ภาพ โดยไม่ต้องถอดรหัสทั้งไฟล์
 * รองรับ PNG / JPEG / WebP / GIF ซึ่งเป็นชนิดที่ระบบอนุญาตให้อัปโหลด
 *
 * คืน null เมื่ออ่านไม่ได้ — ผู้เรียกต้องรองรับกรณีไม่รู้ขนาด
 */
export interface Size { width: number; height: number }

export function readImageSize(buf: Buffer): Size | null {
    return png(buf) ?? gif(buf) ?? webp(buf) ?? jpeg(buf)
}

function png(b: Buffer): Size | null {
    // \x89PNG\r\n\x1a\n แล้วตามด้วยชังก์ IHDR ที่บรรจุขนาดไว้
    if (b.length < 24) return null
    if (b.readUInt32BE(0) !== 0x89504e47) return null
    if (b.toString("ascii", 12, 16) !== "IHDR") return null
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
}

function gif(b: Buffer): Size | null {
    if (b.length < 10) return null
    const sig = b.toString("ascii", 0, 6)
    if (sig !== "GIF87a" && sig !== "GIF89a") return null
    return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) }
}

function webp(b: Buffer): Size | null {
    if (b.length < 30) return null
    if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null

    const format = b.toString("ascii", 12, 16)

    if (format === "VP8 ") {
        // simple lossy: ขนาดอยู่หลัง start code 3 ไบต์
        return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff }
    }
    if (format === "VP8L") {
        // lossless: บรรจุ 14 บิตต่อด้าน แบบ little-endian ต่อเนื่อง
        const bits = b.readUInt32LE(21)
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
    }
    if (format === "VP8X") {
        // extended: เก็บเป็น 24 บิต ค่าจริง = ค่าที่อ่านได้ + 1
        const w = b.readUIntLE(24, 3) + 1
        const h = b.readUIntLE(27, 3) + 1
        return { width: w, height: h }
    }
    return null
}

function jpeg(b: Buffer): Size | null {
    if (b.length < 4 || b.readUInt16BE(0) !== 0xffd8) return null

    let i = 2
    while (i < b.length - 9) {
        if (b[i] !== 0xff) { i++; continue }

        const marker = b[i + 1]

        // SOF0–SOF15 คือเฟรมที่บอกขนาด ยกเว้น DHT(c4) JPG(c8) DAC(cc)
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
            return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) }
        }

        // มาร์กเกอร์ไม่มีเนื้อหา
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue }

        const len = b.readUInt16BE(i + 2)
        if (len < 2) return null
        i += 2 + len
    }
    return null
}

/**
 * กุญแจเทียบเบอร์โทรไทย — เก็บเฉพาะ 9 หลักท้าย (ตัด 0 หรือ +66 ข้างหน้าทิ้ง)
 *
 * เบอร์ใน Registration.phone เก็บตามที่ผู้สมัครพิมพ์มา (มีขีด/เว้นวรรค/+66 ปนกัน)
 * และข้อมูลที่อิมพอร์ตจากชีทมักโดน Excel ตัด 0 ตัวหน้าทิ้ง ("812345678")
 * ถ้าเทียบตรงตัวอักษรจะหาไม่เจอบ่อย เลยเทียบแค่ 9 หลักท้ายที่ทุกรูปแบบมีตรงกัน
 *
 * คืน null ถ้าตัวเลขไม่ถึง 9 หลัก — สั้นกว่านี้เสี่ยงไปตรงกับเบอร์คนอื่น
 */
export function phoneKey(raw: string | null | undefined): string | null {
    const digits = (raw ?? "").replace(/\D/g, "")
    return digits.length >= 9 ? digits.slice(-9) : null
}

/**
 * เลขบัตรประชาชน 13 หลักแบบตัวเลขล้วน — ข้อมูลจากชีทอาจมีขีด/เว้นวรรคปนมา
 * คืน null ถ้าไม่ครบ 13 หลัก
 */
export function nationalIdKey(raw: string | null | undefined): string | null {
    const digits = (raw ?? "").replace(/\D/g, "")
    return digits.length === 13 ? digits : null
}

/** 1-2345-67890-12-3 — อ่านเทียบกับบัตรจริงได้ง่ายกว่าตัวเลขติดกัน 13 หลัก */
export function formatNationalId(raw: string | null | undefined): string | null {
    const id = nationalIdKey(raw)
    if (!id) return raw?.trim() || null
    return `${id[0]}-${id.slice(1, 5)}-${id.slice(5, 10)}-${id.slice(10, 12)}-${id[12]}`
}

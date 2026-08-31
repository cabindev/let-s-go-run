import type { Prisma, RegistrationStatus } from "@prisma/client"

export const REGISTRATION_STATUSES: RegistrationStatus[] = ["PENDING", "PAID", "EXPIRED", "CANCELLED"]

/** ตัวกรองร่วมกันของหน้ารายการลงทะเบียนแอดมินและตัว export — กันสองที่เขียนตรรกะไม่ตรงกัน */
export function buildRegistrationWhere(params: {
    status?: string
    event?: string
    q?: string
}): Prisma.RegistrationWhereInput {
    const { status, event: eventId, q } = params
    const query = q?.trim()

    return {
        ...(REGISTRATION_STATUSES.includes(status as RegistrationStatus) ? { status: status as RegistrationStatus } : {}),
        ...(eventId ? { eventId } : {}),
        ...(query
            ? {
                OR: [
                    { fullName: { contains: query } },
                    { phone: { contains: query } },
                    { bib: { contains: query } },
                    { user: { name: { contains: query } } },
                    { user: { email: { contains: query } } },
                ],
            }
            : {}),
    }
}

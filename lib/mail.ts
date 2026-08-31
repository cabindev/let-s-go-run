import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
})

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
    await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: "ตั้งรหัสผ่านใหม่ · RunLudtong",
        html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
                <p style="font-size: 20px; font-weight: 700; margin: 0 0 24px;">
                    Run<span style="background:#FADF4B; padding: 0 4px; border-radius: 2px;">Ludtong</span>
                </p>
                <h1 style="font-size: 18px; margin: 0 0 12px;">ตั้งรหัสผ่านใหม่</h1>
                <p style="font-size: 14px; color: #3F3F46; line-height: 1.6; margin: 0 0 24px;">
                    มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีนี้ กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ ลิงก์นี้ใช้ได้ครั้งเดียวและหมดอายุใน 1 ชั่วโมง
                    ถ้าคุณไม่ได้ขอ สามารถละเว้นอีเมลนี้ได้ รหัสผ่านเดิมจะยังใช้งานได้ตามปกติ
                </p>
                <a href="${resetUrl}"
                   style="display: inline-block; background: #0A0A0A; color: #ffffff; text-decoration: none;
                          padding: 12px 24px; border-radius: 999px; font-size: 14px; font-weight: 600;">
                    ตั้งรหัสผ่านใหม่
                </a>
                <p style="font-size: 12px; color: #71717A; line-height: 1.6; margin: 24px 0 0; word-break: break-all;">
                    หรือคัดลอกลิงก์นี้ไปวางในเบราว์เซอร์: ${resetUrl}
                </p>
            </div>
        `,
    })
}

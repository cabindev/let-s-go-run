import type { Metadata, Viewport } from "next";
import { Prompt } from "next/font/google";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/configs/auth/authOptions";
import SessionProvider from "@/components/SessionProvider";
import "./globals.css";

const prompt = Prompt({
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-prompt",
});

export const metadata: Metadata = {
  title: {
    default: "RunLudtong · ชุมชนนักวิ่ง",
    template: "%s",
  },
  description: "ค้นหางานวิ่ง สมัครออนไลน์ สะสมระยะทาง และปลดล็อกความสำเร็จไปพร้อมกับเพื่อนนักวิ่ง",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    // suppressHydrationWarning: ส่วนขยายเบราว์เซอร์ (เช่น Scribe, Grammarly, ตัวจับภาพหน้าจอ)
    // มักยัด attribute ใส่ <html>/<body> ก่อน React hydrate ทำให้ HTML ฝั่งเซิร์ฟเวอร์กับ client
    // ไม่ตรงกันทั้งที่โค้ดไม่ได้ผิด — ตัวนี้ปิดการเตือนเฉพาะ attribute ของสองแท็กนี้เท่านั้น
    // ไม่ได้ปิดทั้งต้นไม้ ความผิดพลาดจริงในคอมโพเนนต์ลูกยังฟ้องตามปกติ
    <html lang="th" suppressHydrationWarning>
      <body
        className={`${prompt.variable} font-sans`}
        suppressHydrationWarning
      >
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}

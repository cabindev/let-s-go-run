import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // ฟอร์มสร้าง/แก้ไขงานอัปโหลดได้หลายรูปพร้อมกัน (ปก + เสื้อ + เหรียญ + เส้นทาง + ไซส์ + บรรยากาศ + อื่นๆ)
    // ค่าเริ่มต้น 1MB ของ Next.js ไม่พอ ทำให้ submit form ล้มเหลวทันทีที่มีรูปมากกว่า 1 รูป
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },

  // ส่ง www.runludtong.com ไปโดเมนหลักเสมอ — ล็อกอิน Google เริ่มที่โดเมนไหนก็ต้องจบที่โดเมนเดียวกัน
  // NextAuth ฝากคุกกี้ state/PKCE ไว้กับโดเมนที่กดปุ่ม แต่ Google ส่งกลับมาที่ NEXTAUTH_URL (ไม่มี www)
  // ถ้าเริ่มที่ www คุกกี้จะหายระหว่างทาง ได้ OAuthCallback error แล้วต้องกดปุ่ม Google ซ้ำอีกรอบ
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.runludtong.com" }],
        destination: "https://runludtong.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

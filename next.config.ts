import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // ฟอร์มสร้าง/แก้ไขงานอัปโหลดได้หลายรูปพร้อมกัน (ปก + เสื้อ + เหรียญ + เส้นทาง + ไซส์ + บรรยากาศ + อื่นๆ)
    // ค่าเริ่มต้น 1MB ของ Next.js ไม่พอ ทำให้ submit form ล้มเหลวทันทีที่มีรูปมากกว่า 1 รูป
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;

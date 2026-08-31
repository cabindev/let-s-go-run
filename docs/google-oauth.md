# Google Sign-In (OAuth)

ระบบล็อกอินรองรับ 2 ทาง: **Credentials** (อีเมล/รหัสผ่านเดิม) และ **Google OAuth** (เพิ่มใหม่) — คู่มือนี้อธิบายวิธีตั้งค่าและพฤติกรรมของฝั่ง Google

## Environment variables

ต้องมีใน `.env`:

```
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"   # เปลี่ยนเป็นโดเมนจริงตอน deploy
NEXTAUTH_SECRET="..."
```

## ตั้งค่าใน Google Cloud Console (ต่อ 1 environment)

โปรเจกต์ปัจจุบันที่ใช้: **activerun** (`activerun-507003`) — แยกเป็นโปรเจกต์ของตัวเอง ไม่ปนกับโปรเจกต์อื่นของบัญชี Google

หากต้องตั้งใหม่ (เช่น environment production แยกต่างหาก):

1. [Google Cloud Console](https://console.cloud.google.com) → สร้างโปรเจกต์ใหม่ (หรือใช้ของเดิม)
2. **Google Auth Platform → Branding** — ตั้งชื่อแอป + อีเมลติดต่อ (โชว์บนหน้า consent ตอนผู้ใช้ล็อกอิน)
3. **Google Auth Platform → Audience** — เลือก **External** (ผู้ใช้ทั่วไปด้วย Google Account ใดก็ได้ ไม่ใช่แค่คนในองค์กร)
4. **Google Auth Platform → Clients → Create client** → ประเภท **Web application**
   - **Authorized JavaScript origins**: `http://localhost:3000` (หรือโดเมนจริง)
   - **Authorized redirect URIs**: `http://localhost:3000/api/auth/callback/google` (path นี้ตายตัวตามที่ NextAuth กำหนด — เปลี่ยนแค่ domain/protocol)
5. คัดลอก **Client ID** และ **Client secret** มาใส่ `.env`
   - **สำคัญ**: ค่า Client secret ดูซ้ำไม่ได้อีกหลังปิดหน้าต่างตอนสร้าง ถ้าทำหายต้องกด "Add secret" สร้างใหม่ (ลบตัวเก่าทิ้งได้ทีหลัง)

### Production checklist — โดเมน runludtong.com บน Plesk VPS

โดเมนจริงคือ **runludtong.com** ส่วน hosting คือ Plesk VPS (ของตัวเอง ไม่ใช่ Vercel) ขั้นตอนที่ต้องทำเอง (นอก repo นี้ ไม่มีเครื่องมือไหนทำแทนได้เพราะต้องล็อกอินบัญชี Google/เซิร์ฟเวอร์ของคุณเอง):

1. **Google Cloud Console → Google Auth Platform → Clients** → เปิด OAuth client ตัวเดิม (`activerun-507003`) แล้ว**เพิ่ม** (ไม่ต้องลบของเดิม เก็บ localhost ไว้ทดสอบ local ต่อได้):
   - Authorized JavaScript origins: `https://runludtong.com`
   - Authorized redirect URIs: `https://runludtong.com/api/auth/callback/google`
   - ถ้าใช้ `www.runludtong.com` ด้วย ให้เพิ่มอีกคู่สำหรับ `https://www.runludtong.com`
2. **แอปยังอยู่โหมด Testing** (ใช้ได้เฉพาะอีเมลที่เพิ่มเป็น test user) — ถ้าจะเปิดให้ผู้ใช้ทั่วไปสมัครได้ ต้องกด **Publish app** ใน Google Auth Platform → Audience (scope ที่ขอตอนนี้มีแค่ `openid email profile` ซึ่งเป็น scope พื้นฐาน ไม่น่าต้องผ่าน verification เพิ่ม)
3. **บนเซิร์ฟเวอร์ Plesk** — ไปที่ Node.js app settings ของโดเมน runludtong.com แล้วตั้งตัวแปรแวดล้อม (ไฟล์ `.env` บนเซิร์ฟเวอร์คนละไฟล์กับ `.env` ในเครื่อง dev — ห้ามเอาค่า dev ไปใช้จริง):
   ```
   NEXTAUTH_URL="https://runludtong.com"
   NEXTAUTH_SECRET="<สร้างใหม่ด้วย: openssl rand -base64 32>"   # ห้ามใช้ค่า "secret" ที่ตั้งไว้ตอน dev
   GOOGLE_CLIENT_ID="<ตัวเดิม>"
   GOOGLE_CLIENT_SECRET="<ตัวเดิม>"
   DATABASE_URL="<connection string ของ MySQL บนเซิร์ฟเวอร์จริง>"
   ```
   ต้อง `https://` เท่านั้น (Google OAuth ไม่รับ redirect URI แบบ `http://` บนโดเมนจริง) — ตรวจสอบว่า Plesk ออก SSL cert ให้ runludtong.com แล้ว (Let's Encrypt ฟรีในตัว Plesk)
4. **Stripe webhook** (คนละเรื่องกับ auth แต่ต้องทำคู่กันตอน go-live) — ไปที่ Stripe Dashboard → Webhooks → เพิ่ม endpoint ใหม่ `https://runludtong.com/api/stripe/webhook` แล้วเอา signing secret ที่ได้มาใส่ `STRIPE_WEBHOOK_SECRET` บนเซิร์ฟเวอร์จริง (คนละค่ากับ `whsec_...` ที่ได้จาก `stripe listen` ตอน dev)
5. **อีเมล "ลืมรหัสผ่าน"** (ดู `lib/mail.ts`) — ตั้งค่า `SMTP_USER`/`SMTP_PASSWORD` (Gmail App Password) บนเซิร์ฟเวอร์จริงด้วย ไม่งั้นลิงก์รีเซ็ตจะส่งไม่ออก (ระบบจะ log ลิงก์ไว้ใน server log แทนเป็นทางสำรอง แต่ผู้ใช้จริงมองไม่เห็น log นั้น)

## พฤติกรรมของโค้ด (`lib/configs/auth/authOptions.ts`)

Schema ของโปรเจกต์นี้ **ไม่มี** ตาราง `Account`/`Session` (ไม่ได้ใช้ `PrismaAdapter` — ดูคอมเมนต์ในไฟล์) ระบบใช้ `session: { strategy: 'jwt' }` ล้วนๆ เพราะงั้นตอน sign in ด้วย Google จะไม่มีกลไก find-or-create user ให้อัตโนมัติแบบ adapter — เขียน logic เองไว้ใน `signIn` callback:

```ts
signIn: async ({ user, account }) => {
  if (account?.provider === 'google') {
    const dbUser = await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, image: user.image },
      create: { email: user.email, name: user.name, image: user.image, role: 'USER' },
    })
    user.id = dbUser.id
    user.role = dbUser.role
  }
  return true
}
```

**สรุปพฤติกรรม:**

- **Email ตรงกับบัญชีเดิมที่มีอยู่แล้ว** (ไม่ว่าจะสมัครด้วย credentials หรือ Google มาก่อน) → login เข้าบัญชีเดิมทันที ไม่สร้างซ้ำ ไม่แตะ `password`/`role`/ประวัติเดิม ปลอดภัยเพราะ Google ยืนยัน email มาแล้วว่าเป็นเจ้าของจริง
- **Email ใหม่ที่ไม่เคยมีในระบบ** → สร้าง `User` ใหม่ให้อัตโนมัติ ได้ `role: USER` เป็นค่าเริ่มต้นเสมอ (ไม่มี email ไหนถูกตั้งให้เป็น ADMIN อัตโนมัติ — ต้องไปตั้งเองใน DB)
- ถ้า user เดิมถูกลบออกจากฐานข้อมูลจริงๆ แล้วอีเมลเดิมล็อกอินด้วย Google ซ้ำ → ถือเป็นบัญชีใหม่ ประวัติเก่า (ระยะทาง, registration, achievement) ที่ผูกกับ user เดิมหายไปถาวรตาม cascade delete ของ schema ไม่มีทางกู้คืนจากฝั่งนี้

## ปุ่ม UI

`components/auth/GoogleSignInButton.tsx` — component เดียวใช้ร่วมกันทั้งหน้า `/auth/signin` และ `/auth/signup` (Google OAuth ไม่แยกฟอร์ม signup/signin ปุ่มเดียวทำหน้าที่ทั้งสองอย่าง ขึ้นกับว่า email นั้นมีอยู่แล้วหรือยัง)

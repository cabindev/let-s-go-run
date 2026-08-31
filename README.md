# ActiveRun

แพลตฟอร์มรับสมัครงานวิ่งของไทย (คล้าย race.thai.run) — ผู้จัดงานสร้างกิจกรรมวิ่ง ผู้ใช้สมัคร/จ่ายเงิน/สะสมระยะทาง/ปลดล็อกความสำเร็จ มีระบบหลังบ้านให้แอดมินจัดการงาน ตรวจสลิป และดูภาพรวม

## Stack

| ส่วน | ใช้ | หมายเหตุ |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | **เวอร์ชันนี้ต่างจากที่เทรนมาเยอะ** — อ่าน `node_modules/next/dist/docs/` ก่อนเขียนโค้ดใหม่เสมอ (ดู `AGENTS.md`) |
| UI | React 19, Tailwind CSS 4 | ดีไซน์โทนมินิมอล ขาว-ดำ-แดง แบบ Nike, ใช้ `lucide-react` เป็น icon set หลัก ไม่ใช้ emoji ใน UI |
| Database | MySQL (ผ่าน MAMP, port 3306) + Prisma ORM 6 | schema อยู่ที่ `prisma/schema.prisma` |
| Auth | NextAuth v4 (JWT strategy) | Credentials (email/password) + Google OAuth — **ไม่มี PrismaAdapter/Account table** ดู `docs/google-oauth.md` |
| Payment | Stripe (Checkout Sessions + Webhook) | รองรับบัตร + PromptPay ผ่าน dynamic payment methods |
| Validation | Zod | ใช้ในทุก server action ที่รับ input จากฟอร์ม |
| Language | TypeScript, ข้อความ/คอมเมนต์เป็นภาษาไทย | โค้ดใหม่ควรคอมเมนต์เป็นไทยให้เข้ากับของเดิม |

## แนวคิดหลักของระบบ

**Event** มี 2 ประเภท แยก route กันชัดเจน:
- `ONSITE` — วิ่งในงานจริง ไม่ต้องส่งผล จบงานแล้วนับระยะให้อัตโนมัติถ้าจ่ายเงินแล้ว → route `/events/[id]`
- `VIRTUAL` — วิ่งสะสมระยะที่ไหนก็ได้ ต้องส่งผลเอง (บังคับแนบรูปหลักฐานทุกครั้ง) → route `/virtual/[id]`

**Registration** มีสถานะ (`RegistrationStatus`): `PENDING` (รอจ่าย) → `WAITING` (ส่งสลิปรอตรวจ) หรือจ่ายผ่าน Stripe ตรงเป็น `PAID` เลย → `PAID` / `REJECTED` (สลิปไม่ผ่าน) / `EXPIRED` (ไม่จ่ายในเวลาที่กำหนด ที่นั่งคืนอัตโนมัติ) / `CANCELLED`

**วิธีจ่ายเงิน 2 ทาง** คู่ขนานกัน:
1. โอนเงิน + อัปโหลดสลิป → แอดมินตรวจด้วยตาที่ `/admin/slips` (`approveSlip`/`rejectSlip`)
2. Stripe Checkout (บัตร/PromptPay) → webhook ยืนยันอัตโนมัติ ไม่ต้องรอแอดมิน (`app/api/stripe/webhook`)

ทั้งสองทางจบที่ฟังก์ชันเดียวกันในทางปฏิบัติ:ตั้ง `status: PAID`, ออกเลข BIB (`withBib` ใน `lib/vr.ts` — ใช้ atomic increment ผ่าน `Event.bibCounter` กันเลขชนกัน), คำนวณ `totalDistance` ใหม่ (`recalculateUserStats`), เช็คปลดล็อกความสำเร็จ (`unlockAchievements`)

**Achievement / Level** — Achievement เป็นเหรียญที่แอดมินตั้งเกณฑ์เองได้ (จำนวนกิจกรรม หรือ ระยะสะสม) ส่วน Level (Bronze→Diamond) คำนวณจาก `totalDistance` ล้วนๆ ไม่ผูกกับ DB (`lib/levels.ts`) ไอคอนทั้งสองระบบ render ผ่าน `AchievementIcon`/`LevelIcon` (แปลง emoji ที่เก็บใน DB เป็น `lucide-react` icon จริง เพราะ emoji บังคับสีไม่ได้)

## โครงสร้างโปรเจกต์

```
app/
  (home)/            หน้าแรก (list งาน + filter)
  (main)/
    events/[id]/      รายละเอียดงาน ONSITE + สมัคร
    virtual/[id]/      รายละเอียดงาน VIRTUAL + ส่งผลวิ่ง
    payment/[id]/      หน้าจ่ายเงิน (โอน/Stripe)
    profile/           โปรไฟล์ผู้ใช้ (สถิติ, ประวัติ, achievement)
    leaderboard/
  admin/               หลังบ้าน (ต้อง role ADMIN — กันด้วย middleware.ts + requireAdminPage())
  actions/             Server Actions ทั้งหมด (registration, checkout, submission, admin, auth, profile)
  api/
    auth/[...nextauth]/  NextAuth handler
    stripe/webhook/       Stripe webhook (ตรวจ signature เอง)
    cron/expire/           กวาดสถานะ EXPIRED (ไม่มี cron job อัตโนมัติเรียกตอนนี้ ต้องเรียกเอง)
  auth/signin, signup/  หน้า login/สมัคร

lib/                   Business logic ล้วนๆ (ไม่มี UI) — events, expiry, stats, achievements, levels, vr, stripe
components/
  ui/                  Base components (Button, Badge, Card, AchievementIcon, LevelIcon, ...)
  events/ payment/ profile/ auth/ admin/ layout/   Feature-specific components

prisma/
  schema.prisma        Models ทั้งหมด
  migrations/           ประวัติ migration
  seed.ts               ข้อมูลตัวอย่าง (npm run db:seed)
```

## Local development

```bash
npm install
cp .env.example .env   # ถ้ามี — ไม่งั้นดู .env ที่มีอยู่แล้วเป็นตัวอย่าง
npx prisma migrate deploy
npm run db:seed        # ถ้าต้องการข้อมูลตัวอย่าง
npm run dev
```

**Environment variables ที่ต้องมี** (ดู `.env`): `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `CRON_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — รายละเอียด Stripe/Google ดูใน `docs/`

**ทดสอบ Stripe ใน local** ต้องรัน `stripe listen --forward-to localhost:3000/api/stripe/webhook` ค้างไว้คู่กับ `npm run dev`

## ก่อนขึ้น Production

ตอนนี้ค่า config ทั้งหมดเป็นของ **local/test เท่านั้น** — สิ่งที่ต้องเตรียมใหม่ก่อนขึ้นเซิร์ฟเวอร์จริง:

### 1. Google OAuth ต้องใช้ URL จริง

`.env` ตอนนี้ผูก `NEXTAUTH_URL="http://localhost:3000"` และ OAuth client (โปรเจกต์ `activerun-507003`) ตั้ง origin/redirect URI ไว้แค่ localhost — ต้องทำ:

1. เปลี่ยน `NEXTAUTH_URL` ใน `.env` ของเซิร์ฟเวอร์จริงเป็นโดเมนจริง (เช่น `https://activerun.app`)
2. เข้า [Google Cloud Console](https://console.cloud.google.com) → โปรเจกต์ `activerun` → **Google Auth Platform → Clients** → เปิด client "activerun" → **เพิ่ม** (ไม่ต้องลบของ localhost ทิ้ง เก็บไว้ dev ต่อได้):
   - Authorized JavaScript origins: `https://โดเมนจริง`
   - Authorized redirect URIs: `https://โดเมนจริง/api/auth/callback/google`
3. **Google Auth Platform → Audience** — กด **Publish app** เพื่อออกจากโหมด Testing (ตอนนี้ล็อกอินได้เฉพาะอีเมลที่เพิ่มเป็น test user เท่านั้น) — scope ที่ขอ (`openid email profile`) เป็น scope พื้นฐาน ปกติไม่ต้องรอ Google verify เพิ่ม
4. รายละเอียดเต็มดู `docs/google-oauth.md`

### 2. ระบบ "ลืมรหัสผ่าน" — ยังไม่มี ต้องสร้างใหม่

ตอนนี้ auth ฝั่ง credentials มีแค่ signup/signin เท่านั้น **ไม่มีทาง reset รหัสผ่านเลยถ้าลืม** (เช็คแล้ว ไม่มีโค้ด/หน้า/แม้แต่ email service ในโปรเจกต์) ผู้ใช้ที่ลืมรหัสผ่านตอนนี้ต้องให้แอดมินช่วยรีเซ็ตในฐานข้อมูลตรงๆ เท่านั้น — ก่อนขึ้น production ควรมีอย่างน้อย:

- **Email service** — ยังไม่มี package ส่งอีเมลเลย (เช่น Resend, Nodemailer + SMTP) ต้องเลือกและติดตั้งก่อน เป็นของใหม่ที่ต้องเพิ่ม
- **Model เก็บ reset token** — เพิ่ม model ใหม่ใน `prisma/schema.prisma` เช่น `PasswordResetToken { token, userId, expiresAt }` (คล้ายแนวทางเดียวกับที่ `expiresAt` ใช้กันเวลาหมดอายุการจ่ายเงินอยู่แล้ว)
- **หน้า + server action**: `/auth/forgot-password` (กรอกอีเมล → ส่งลิงก์), `/auth/reset-password?token=...` (ตั้งรหัสผ่านใหม่), เช็ค token หมดอายุ/ใช้แล้วไม่ให้ใช้ซ้ำ
- ลิงก์ "ลืมรหัสผ่าน?" ใต้ฟอร์ม `SignInForm.tsx` (ตอนนี้ยังไม่มีลิงก์นี้เลย)

### 3. อื่นๆ ที่มักลืม

- **`NEXTAUTH_SECRET` ตอนนี้เป็นค่า placeholder `"secret"` ตรงๆ** — ต้องเปลี่ยนเป็นค่าสุ่มยาวๆ ก่อนขึ้นจริงเด็ดขาด (รันได้ด้วย `openssl rand -base64 32`) ถ้าใช้ค่าเดิมเท่ากับใครก็ปลอม JWT session ได้
- **Stripe** — สลับจาก `sk_test_...`/`pk_test_...` เป็นคีย์ live จริง และไปสร้าง webhook endpoint ใหม่ใน Stripe Dashboard ชี้มาที่โดเมนจริง (ตอนนี้ `STRIPE_WEBHOOK_SECRET` เป็นของ `stripe listen` local เท่านั้น ใช้กับ production ไม่ได้) — แนะนำเปลี่ยนเป็น restricted API key ด้วย ดูรายละเอียดเรื่องนี้ที่คุยไว้ก่อนหน้า
- **`DATABASE_URL`** — ตอนนี้ชี้ไป MySQL local ผ่าน MAMP ต้องเปลี่ยนเป็น production database
- **ไฟล์อัปโหลด (`public/uploads/`)** — บันทึกลง local filesystem ตรงๆ ถ้า deploy ขึ้น hosting แบบ serverless (เช่น Vercel) ไฟล์จะ**ไม่คงอยู่ถาวร** ต้องย้ายไปใช้ object storage (S3, Cloudflare R2, ฯลฯ) ก่อนขึ้นจริง
- **Cron** — `/api/cron/expire` ยังไม่มีตัวเรียกอัตโนมัติ ถ้าต้องการให้สถานะ `EXPIRED` อัปเดตเองตามเวลาจริง ต้องตั้ง scheduler (เช่น Vercel Cron) ให้เรียก endpoint นี้เป็นระยะ

## Gotchas ที่เจอมาแล้ว (กันเสียเวลาซ้ำ)

- **แก้ `prisma/schema.prisma` แล้วต้อง `npx prisma generate` ใหม่ + restart dev server** — ไม่งั้น Prisma Client ที่ dev server โหลดค้างไว้จะไม่รู้จัก field ใหม่ (error "Invalid `prisma.x.update()` invocation")
- **แก้ `.env` ก็ต้อง restart dev server** เหมือนกัน (Next.js ไม่ hot-reload env vars)
- **`prisma migrate dev` ใช้ไม่ได้ใน non-interactive shell** (error "environment is non-interactive") — ใช้ `prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ...` เพื่อ gen SQL แล้วสร้างโฟลเดอร์ migration เอง ตามด้วย `prisma migrate deploy`
- **ระวัง Turbopack cache ค้าง** หลังแก้ import/export ข้าม module โดยเฉพาะไฟล์ที่มี `'use server'` — ถ้าเจอ error ที่อ้างโค้ดเก่าที่แก้ไปแล้ว ให้ `rm -rf .next` แล้ว restart
- **ไฟล์ที่มี `'use server'` export ได้เฉพาะ async function** — ค่าคงที่/array ต้องย้ายไปไฟล์ธรรมดา (เจอตอนเอา `PAYABLE_STATUS` ไปแชร์ระหว่าง server action กับ route handler)
- **`Event.bibCounter`** คือตัวนับ atomic สำหรับออกเลข BIB — อย่ากลับไปใช้วิธี `MAX(bib) + 1` แบบเดิม เพราะไม่ atomic พิสูจน์แล้วว่าพังจริงเมื่อมีคนยืนยันจ่ายเงินพร้อมกันหลายคน
- **ไม่มี cron job อัตโนมัติ** เรียก `/api/cron/expire` — การกันที่นั่ง/ปล่อยที่นั่งคืนทำงานถูกต้องอยู่แล้วเพราะคำนวณจาก `expiresAt` สดทุกครั้ง แต่สถานะ `EXPIRED` ในหน้าจอจะไม่อัปเดตเองถ้าไม่มีคนเรียก endpoint นี้

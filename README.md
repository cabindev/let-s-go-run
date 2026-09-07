# RunLudtong

แพลตฟอร์มรับสมัครงานวิ่ง + ร้านค้าของที่ระลึก — ผู้จัดสร้างงาน ผู้ใช้สมัคร/จ่ายเงิน/สะสมระยะ/ปลดล็อกความสำเร็จ และซื้อเสื้อ-ของที่ระลึกได้ในระบบเดียวกัน มีหลังบ้านให้แอดมินจัดการงาน ผู้สมัคร สินค้า ออเดอร์ และโควตาสิทธิพิเศษ

**ขึ้นใช้งานจริงแล้วที่ [runludtong.com](https://runludtong.com)** — deploy บน Plesk VPS (14.207.143.39) ผ่าน `server.js` (custom Express server เพราะ Passenger ต้องการ entry file ที่เรียก `.listen()` เอง)

## Stack

| ส่วน | ใช้ | หมายเหตุ |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | **เวอร์ชันนี้ต่างจากที่เทรนมาเยอะ** — อ่าน `node_modules/next/dist/docs/` ก่อนเขียนโค้ดใหม่เสมอ (ดู `AGENTS.md`) |
| UI | React 19, Tailwind CSS 4 | ดีไซน์มินิมอล ใช้ `lucide-react` เป็น icon set หลัก ไม่ใช้ emoji ใน UI |
| Database | MySQL (local ผ่าน MAMP port 3306) + Prisma ORM 6 | schema อยู่ที่ `prisma/schema.prisma` |
| Auth | NextAuth v4 (JWT strategy) | Credentials + Google OAuth — **ไม่มี PrismaAdapter/Account table** ดู `docs/google-oauth.md` |
| Payment | Stripe (Checkout Sessions + Webhook) | บัตร + PromptPay · **ใช้คีย์ live จริงแล้ว** · ผู้จ่ายรับภาระค่าธรรมเนียม (`lib/checkout-fees.ts`) |
| Email | Nodemailer + SMTP (Gmail) | `lib/mail.ts` — ส่งแบบ "ห้ามพัง" มี timeout 3 ชั้น ส่งไม่ออกก็ไม่ทำให้คำสั่งซื้อล้ม |
| Validation | Zod | ใช้ในทุก server action ที่รับ input จากฟอร์ม |
| Language | TypeScript, ข้อความ/คอมเมนต์เป็นภาษาไทย | โค้ดใหม่ควรคอมเมนต์เป็นไทยให้เข้ากับของเดิม |

## แนวคิดหลักของระบบ

### งานวิ่ง

**Event** มี 2 ประเภท แยก route กันชัดเจน:
- `ONSITE` — วิ่งในงานจริง ไม่ต้องส่งผล จบงานแล้วนับระยะให้อัตโนมัติถ้าจ่ายเงินแล้ว → `/events/[id]`
- `VIRTUAL` — วิ่งสะสมระยะที่ไหนก็ได้ ต้องส่งผลเอง (บังคับแนบรูปหลักฐาน) → `/virtual/[id]`

**Registration** มี 4 สถานะ: `PENDING` (รอจ่าย) → `PAID` / `EXPIRED` (ไม่จ่ายในเวลา ที่นั่งคืนอัตโนมัติ) / `CANCELLED`

> จ่ายผ่าน **Stripe ทางเดียวเท่านั้น** — ระบบอัปโหลดสลิปให้แอดมินตรวจด้วยตาถูกถอดออกไปแล้ว (สถานะ `WAITING`/`REJECTED` และหน้า `/admin/slips` ไม่มีอีกแล้ว)

**การกันที่นั่ง** คำนวณจาก `expiresAt` สดทุกครั้ง (`heldSeatWhere()` ใน `lib/expiry.ts`) ที่นั่งจึงถูกปล่อยคืนทันทีที่หมดเวลา ไม่ต้องรอ cron มากวาด — cron แค่เปลี่ยน *ป้ายสถานะ* ให้ตรงเท่านั้น

**BIB** ออกด้วย atomic increment ผ่าน `Event.bibCounter` กันเลขชนกันตอนคนจ่ายพร้อมกัน

### โควตาสิทธิพิเศษ (สปอนเซอร์ / แขกผู้จัดงาน)

โค้ดที่ให้สมัครฟรีหรือลดราคาโดยที่ผู้สมัครทั่วไปไม่รู้ว่ามีอยู่ — `InviteCode` ตารางเดียวรองรับทุกแบบ ต่างกันแค่ `maxUses`:

| ต้องการ | ตั้งค่า |
|---|---|
| โค้ดเดียวแจกทั้งกลุ่ม | 1 แถว `maxUses = 20` |
| โค้ดใช้ครั้งเดียวรายคน | 20 แถว `maxUses = 1` ชื่อกลุ่มเดียวกัน |

หลักการที่ระบบยึด:

- **ที่นั่งจากโค้ดอยู่นอกจำนวนรับสมัครที่ประกาศ** — รับ 400 + โค้ด 40 = 440 คนจริง จึงมี `publicSeatWhere()` แยกจาก `heldSeatWhere()` ประตูรับสมัครกับตัวเลข "ที่นั่งเหลือ" ที่ผู้สมัครเห็นใช้ตัวแรก ส่วนหน้าแอดมินใช้ตัวหลังเพราะต้องเห็นยอดรวมจริงไว้สั่งเสื้อ/แจ้งประกัน
- **ผู้ถือโค้ดข้ามโควตาทั้งของงานและของรุ่น** ถ้าข้ามแค่อย่างเดียว สปอนเซอร์ที่อยากวิ่งรุ่นที่เต็มจะใช้สิทธิ์ไม่ได้ · ส่วนเกินมีเพดานเท่าจำนวนสิทธิ์ที่ออกไว้เสมอ
- **โค้ดที่ทำให้ยอดเป็น 0 บังคับรับของหน้างาน** ทับค่าฝั่งเซิร์ฟเวอร์เสมอ ไม่ใช่แค่ซ่อนตัวเลือก — เงื่อนไขผูกกับ "ยอดเป็นศูนย์" ไม่ใช่ "เป็นโค้ดสปอนเซอร์" กติกาเดียวจึงคุมได้ทั้งโค้ดฟรีและโค้ดลดบางส่วน (ที่ยังส่งไปรษณีย์ได้)
- **ยอด 0 = ใช้ทางเดินงานฟรีเดิม** ยืนยันทันที ออก BIB เลย ไม่แตะ Stripe
- **ตัดสิทธิ์แบบ atomic** `updateMany` + `usedCount < maxUses` เช็ค `count === 1` ในทรานแซกชันเดียวกับที่ล็อกแถว Event
- **ตัวเลขที่แสดง นับจากใบสมัครจริง ไม่ใช่ `usedCount`** — `usedCount` มีไว้จองสิทธิ์ตอนสมัครเท่านั้น มันเพี้ยนได้ (ลบผู้ใช้ทิ้ง ใบสมัครหายตาม cascade แต่ตัวนับไม่ลด) ถ้าสองค่าไม่ตรงกันหน้าแอดมินจะขึ้นเตือน
- **ช่องกรอกโค้ดต้องไม่โฆษณาตัวเอง** เป็นลิงก์เล็ก ๆ พับไว้ชื่อ "ใช้โค้ด" ไม่มี placeholder ตัวอย่าง (ตัวอย่างบอกทั้งความยาวและชุดตัวอักษรให้คนเดา) และไม่ใช้คำว่า "สิทธิพิเศษ" ในหน้าที่คนทั่วไปเห็น เพราะคนที่จ่ายเต็มราคาไม่ควรรู้สึกว่าจ่ายแพงกว่าคนอื่น

### ร้านค้า

ตาราง `Product` / `ProductVariant` / `Cart` / `Order` แยกจากงานวิ่งสิ้นเชิง แต่อยู่ในโปรเจกต์/ฐานข้อมูลเดียวกันเพื่อใช้ `User`, Stripe, auth, ดีไซน์ และอีเมลร่วมกัน · `Product.eventId` เป็น optional ผูกกับงานวิ่งก็ได้ ไม่ผูกก็ได้

- **สต็อกตัดตอนสร้างออเดอร์** (จอง) คืนตอนหมดเวลา/ยกเลิก — `$transaction` + `SELECT ... FOR UPDATE` + `updateMany({ where: { stock: { gte: qty } } })` เช็ค `count === 1`
- **ตะกร้าที่มีทั้งของพร้อมส่งและพรีออเดอร์จะถูกแยกเป็น 2 ออเดอร์** เพราะรอบจัดส่งต่างกัน แต่ละใบคิดค่าส่งของตัวเอง
- **ค่าส่ง** ชิ้นแรกเต็มราคา ชิ้นถัดไปบวกเพิ่มชิ้นละเท่าที่ตั้งไว้ (`shippingFee()` ใน `lib/shop.ts`) แอดมินตั้งเองที่ `/admin/shop`

### Achievement / Level

Achievement เป็นเหรียญที่แอดมินตั้งเกณฑ์เองได้ (จำนวนกิจกรรม หรือ ระยะสะสม) ส่วน Level (Bronze→Diamond) คำนวณจาก `totalDistance` ล้วน ๆ ไม่ผูกกับ DB (`lib/levels.ts`)

## โครงสร้างโปรเจกต์

```
app/
  (home)/              หน้าแรก (list งาน + สินค้า + filter)
  (main)/
    events/[id]/       รายละเอียดงาน ONSITE + สมัคร
    virtual/[id]/      รายละเอียดงาน VIRTUAL + ส่งผลวิ่ง
    payment/[id]/      หน้าจ่ายเงินค่าสมัคร
    shop/ cart/ checkout/ orders/   ร้านค้า
    profile/ leaderboard/
  admin/               หลังบ้าน (กันด้วย middleware.ts + requireAdminPage())
    events/ registrations/ invite-codes/ checkin/ submissions/
    products/ orders/ shop/ users/ achievements/
  actions/             Server Actions ทั้งหมด
  api/
    auth/[...nextauth]/   NextAuth handler
    stripe/webhook/       Stripe webhook — เส้นเดียวรับทั้งค่าสมัครและออเดอร์ร้านค้า
                          แยกทางด้วย session.metadata.kind
    cron/expire/          กวาด EXPIRED ทั้งใบสมัครและออเดอร์
    admin/**/export/      ไฟล์ Excel (exceljs)
  auth/                signin, signup, forgot-password, reset-password

lib/                   Business logic ล้วน ๆ ไม่มี UI
components/
  ui/                  Base components
  events/ shop/ payment/ profile/ auth/ admin/ layout/

prisma/
  schema.prisma        Models ทั้งหมด
  migrations/          ประวัติ migration
  seed.ts              ข้อมูลตัวอย่าง (npm run db:seed)

docs/
  production-migrations.md   วิธีรัน migration บน production + ประวัติทุกครั้งที่รัน
  google-oauth.md
```

## Local development

```bash
npm install
npx prisma migrate deploy
npm run db:seed        # ถ้าต้องการข้อมูลตัวอย่าง
npm run dev
```

**Environment variables** (ดู `.env`): `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `CRON_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`

**ทดสอบ Stripe ใน local** รัน `stripe listen --forward-to localhost:3000/api/stripe/webhook` ค้างไว้คู่กับ `npm run dev`

**ทดสอบโดยไม่ให้อีเมลหลุดออกไปจริง** — สั่ง `SMTP_USER= SMTP_PASSWORD= npm run dev` ค่าที่ตั้งทับตอนสั่งจะชนะค่าใน `.env` (Next ไม่ override ค่าที่มีอยู่แล้วใน env) แล้ว `safeSend()` จะข้ามการส่งพร้อม log `[mail] ยังไม่ได้ตั้งค่า SMTP` ให้ตรวจย้อนหลังได้

## Deploy ขึ้น production

1. `git push` ขึ้น GitHub
2. **ถ้ามี migration ใหม่** — ทำก่อน deploy เสมอ ตาม `docs/production-migrations.md` (**export ฐานข้อมูลก่อนทุกครั้ง ไม่มีข้อยกเว้น**) รัน SQL มือผ่าน phpMyAdmin เพราะ `DATABASE_URL` ที่ Plesk ฉีดให้ไปไม่ถึง shell
3. Plesk → Git → **Pull now** → **Deploy now** (auto-pull ไม่ทำงาน ต้องกดเอง)

### ที่ยังค้างอยู่

- **Cron `/api/cron/expire` ยังไม่มีตัวเรียกอัตโนมัติ** — ควรตั้ง Plesk Scheduled Task แบบ "Run a command" (ไม่ใช่ "Fetch a URL" เพราะส่ง header ไม่ได้) ยิงทุก 15 นาที พร้อม `Authorization: Bearer $CRON_SECRET` · การกัน/ปล่อยที่นั่งทำงานถูกอยู่แล้วโดยไม่ต้องมี cron แต่ป้ายสถานะจะไม่อัปเดตเอง
- **ไฟล์อัปโหลด (`public/uploads/`)** บันทึกลง filesystem ตรง ๆ อยู่บน VPS จึงคงอยู่ถาวร แต่ถ้าย้ายไป serverless ต้องเปลี่ยนไปใช้ object storage
- **หมุน secret ที่เคยหลุดในแชต** — Google client secret และ SMTP app password

## Gotchas ที่เจอมาแล้ว (กันเสียเวลาซ้ำ)

### Prisma

- **แก้ schema แล้วต้อง `npx prisma generate` + restart dev server** ไม่งั้น Prisma Client ที่ dev server โหลดค้างจะไม่รู้จัก field ใหม่ · ถ้ายังพังอยู่ให้ `rm -rf .next` ด้วย เพราะ Turbopack cache client ตัวเก่าไว้อีกชั้น
- **`prisma generate` ต้องอยู่ใน `build` script ไม่ใช่พึ่ง `postinstall` อย่างเดียว** — `postinstall` ทำงานเฉพาะตอน npm ติดตั้งอะไรจริง ๆ ถ้า dependency ไม่เปลี่ยน จะได้ Prisma Client ตัวเก่าแล้ว type check พังทั้งไฟล์ (เคยทำ production build ล่มมาแล้ว)
- **`prisma migrate dev` ใช้ไม่ได้ใน non-interactive shell** — ใช้ `prisma migrate diff` gen SQL แล้วสร้างโฟลเดอร์ migration เอง ตามด้วย `prisma migrate deploy`
- **`_count` ใส่ตัวกรองให้ relation เดียวกันได้แค่ชุดเดียว** ถ้าต้องนับสองแบบ (เช่น ที่นั่งสาธารณะ vs สิทธิพิเศษ) ต้องยิง `groupBy` แยกอีกรอบ

### ความถูกต้องของข้อมูล

- **`Event.bibCounter` คือตัวนับ atomic สำหรับออกเลข BIB** อย่ากลับไปใช้ `MAX(bib) + 1` พิสูจน์แล้วว่าพังจริงเมื่อมีคนจ่ายพร้อมกัน
- **เปลี่ยนสถานะแล้วค่อยทำ side-effect ต้องเช็ค `count === 1` จาก `updateMany` เสมอ** (คืนสต็อก คืนสิทธิ์โค้ด ออก BIB) และ **เงื่อนไข WHERE ต้องเป็น "สถานะที่ยังทำได้" ไม่ใช่สถานะที่อ่านมาก่อนเข้าทรานแซกชัน** — เคยพลาดตรงนี้จนกดยกเลิกซ้ำแล้วคืนสิทธิ์ให้สปอนเซอร์งอกเกินที่ออกไว้
- **ตัวนับที่ดูแลเอง (`usedCount`) ไม่ใช่ความจริง** ใช้จองสิทธิ์แบบ atomic ได้ แต่เวลาจะ *แสดงผล* ให้นับจากข้อมูลจริง — cascade delete ทำให้ตัวนับเพี้ยนได้โดยไม่มีใครรู้
- **`formData.get()` คืน `null` สำหรับ field ที่ไม่ได้ถูกเรนเดอร์** ซึ่ง Zod `.optional()` ไม่รับ (รับแค่ `undefined`) จะได้ error "Invalid input" ที่ไล่หาต้นตอยาก — ใช้ `formString()` ใน `lib/utils.ts`

### Next.js / React

- **ไฟล์ที่มี `'use server'` export ได้เฉพาะ async function** ค่าคงที่/array ต้องย้ายไปไฟล์ธรรมดา
- **`redirect()` โยน exception** ต้องอยู่นอก try/catch ไม่งั้นถูก catch กลืน
- **`position: sticky` สร้าง stacking context** ทำให้ `z-index` ของลูกถูกจำกัดอยู่แค่ในนั้น — lightbox/modal ต้อง `createPortal` ไป `document.body`
- **แก้ `.env` ต้อง restart dev server** Next ไม่ hot-reload env vars

### ดีไซน์

- **ห้ามใช้ `bg-paper-2` เป็นพื้นการ์ด** เพราะสีเดียวกับพื้นหน้า จะมองไม่เห็นขอบการ์ด ใช้ `bg-paper` + `border-line`
- **อย่าเขียนตัวเลขเป็นสมการ** เช่น `20 + 0 = 20` — ตอนค่าใดค่าหนึ่งเป็นศูนย์มันไม่ได้บอกอะไรเลย ใช้รายการ "ชื่อ → จำนวน → ประโยคอธิบาย" แทน

### วันที่ / ภาษาไทย

- **`<input type="date">` บนเบราว์เซอร์ภาษาไทยโชว์ปี พ.ศ.** ผู้ใช้พิมพ์ 2569 ลงไปแล้วระบบเก็บเป็น ค.ศ. 2569 ตรง ๆ พอ `formatDate()` บวก 543 อีกรอบจะได้ "3112" — ปีที่เกิน 2400 ให้ลบ 543 กลับ (`parseThaiFriendlyDate()` ใน `app/actions/admin.ts`)

### อีเมล

- **อย่าใช้ SVG ในอีเมล** Gmail ตัดทิ้ง Outlook ไม่แสดง — โลโก้ในเมลใช้ PNG (`public/runludtong-logo-email.png`) และต้องเป็น URL เต็มเสมอ
- **การส่งอีเมลต้องไม่ทำให้ธุรกรรมล้ม** `safeSend()` ไม่เคย throw และมี deadline 8 วินาที (เคยเจอ webhook ช้า 4 วินาทีเพราะรอ SMTP)

### phpMyAdmin

- **พาสต์ SQL ก้อนยาวแล้วบรรทัดซ้ำได้** เคยเจอ `#1060 Duplicate column name` · `CREATE TABLE` ล้มทั้งคำสั่งจึงไม่มีตารางค้าง แต่ `ALTER TABLE` ก่อนหน้าผ่านไปแล้ว — ต้องเช็ค `information_schema` ว่ารันถึงไหนก่อน แล้วรันต่อเฉพาะส่วนที่เหลือ **ห้ามรันซ้ำทั้งก้อน**

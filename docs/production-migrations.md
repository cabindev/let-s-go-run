# วิธีรัน Prisma Migration บน Production

อัปเดตล่าสุด: 2 กันยายน 2569

## กฎเหล็ก: Export ฐานข้อมูล production ไว้ก่อนทุกครั้ง — ไม่มีข้อยกเว้น

ก่อนรัน SQL ใดๆ ที่แก้โครงสร้างตาราง (ALTER/DROP/CREATE) บนฐานข้อมูล production **ต้อง export ฐานข้อมูลทั้งก้อนไว้ก่อนเสมอ** แม้จะมั่นใจว่า SQL ถูกต้องแล้วก็ตาม เผื่อกรณี:

- พิมพ์ชื่อคอลัมน์/ตารางผิด แล้วลบข้อมูลจริงไปโดยไม่ตั้งใจ
- checksum ที่ใส่ใน `_prisma_migrations` ไม่ตรง ทำให้ `prisma migrate deploy` ในอนาคตงงว่า migration ไหนถูก apply ไปแล้วจริง
- เซิร์ฟเวอร์ตัดกลางคันระหว่างรัน SQL หลายคำสั่งต่อกัน

### วิธี export (เลือกอันใดอันหนึ่ง)

**ผ่าน Plesk (แนะนำ ง่ายสุด):**
Plesk → เว็บไซต์ `runludtong.com` → **Databases** → แถวฐานข้อมูล `runludtong` → ปุ่ม **Export dump** → ดาวน์โหลดไฟล์ `.sql` เก็บไว้

**ผ่าน phpMyAdmin:**
เข้า phpMyAdmin ตามขั้นตอนด้านล่าง → เลือกฐานข้อมูล `runludtong` → แท็บ **Export** → Quick/Custom → กด Go → ดาวน์โหลดไฟล์

เก็บไฟล์ backup ไว้อย่างน้อยจนกว่าจะยืนยันว่า migration ใหม่ทำงานถูกต้องสัก 2-3 วัน

## ทำไมรัน `npm run db:migrate` (prisma migrate deploy) ตรงๆ บน production ไม่ได้

- `DATABASE_URL` และตัวแปรอื่นๆ ที่เห็นในหน้า Plesk → Node.js → Dashboard → "Custom environment variables" เป็นค่าที่ **Plesk ฉีดให้เฉพาะตอน Passenger สตาร์ทแอปจริงเท่านั้น**
- ค่านี้ **ไม่ถูกส่งต่อ** ให้กับคำสั่งที่รันแยกผ่าน SSH terminal หรือหน้า Plesk → Node.js → "Run Node.js commands" — ทั้งสองทางจะเจอ error แบบ:
  ```
  Error: Environment variable not found: DATABASE_URL.
  ```
- เคยลองแก้ด้วยการสร้างไฟล์ `.env` จริงใน `~/httpdocs` (ให้ `prisma.config.ts` ซึ่ง import `dotenv/config` โหลดเอง) แต่ตัดสินใจไม่ทำ เพราะไม่อยากมีค่า secret ซ้ำสองที่ (ทั้งใน Plesk panel และในไฟล์ดิสก์) — ถ้าจะทำภายหลังค่อยพิจารณาใหม่

**สรุป:** จนกว่าจะแก้เรื่องนี้ วิธีที่ใช้ได้จริงคือรัน SQL มือผ่าน phpMyAdmin ตามขั้นตอนด้านล่าง

## ขั้นตอนที่ใช้จริง (manual ผ่าน phpMyAdmin)

### 1) เตรียม SQL จาก migration ที่ยังไม่ได้ apply บน production

ในเครื่อง local:
```
ls prisma/migrations/
```
ดูว่า migration ไหนใหม่กว่ารายการล่าสุดที่มีบน production (เช็คจากตาราง `_prisma_migrations` บน production ว่ามีกี่แถว/ชื่ออะไรบ้าง เทียบกับ local)

อ่านเนื้อหาไฟล์ `migration.sql` ของแต่ละตัวที่ยังไม่ได้ apply มาเรียงต่อกันตามลำดับเวลา (ชื่อโฟลเดอร์ขึ้นต้นด้วย timestamp อยู่แล้ว เรียงจากน้อยไปมาก)

### 2) ดึง checksum ของแต่ละ migration จากฐานข้อมูล local

Local ที่รัน `prisma migrate dev` ไปแล้วจะมี checksum ที่ถูกต้องอยู่ในตาราง `_prisma_migrations` ของตัวเองอยู่แล้ว ไม่ต้องคำนวณเอง:
```
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.\$queryRaw\`SELECT * FROM _prisma_migrations WHERE migration_name IN ('ชื่อ_migration_1','ชื่อ_migration_2')\`.then((r)=>{
  console.log(JSON.stringify(r, (k,v)=> typeof v === 'bigint' ? v.toString() : v, 2));
  return p.\$disconnect();
});
"
```
ได้ค่า `id`, `checksum`, `finished_at`, `started_at`, `applied_steps_count` มาใช้ต่อ

### 3) ประกอบเป็น SQL ก้อนเดียว

```sql
-- เนื้อหาจากแต่ละ migration.sql เรียงตามลำดับ
ALTER TABLE `Event` ADD COLUMN ...;
ALTER TABLE `Registration` ADD COLUMN ...;

-- บันทึกลง bookkeeping table ของ Prisma ท้ายสุด — สำคัญมาก ถ้าลืมขั้นนี้
-- prisma migrate deploy ในอนาคตจะพยายาม apply migration เดิมซ้ำแล้ว error ว่าคอลัมน์มีอยู่แล้ว
INSERT INTO `_prisma_migrations`
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES
  ('<id จาก local>', '<checksum จาก local>', '<finished_at>', '<ชื่อโฟลเดอร์ migration>', NULL, NULL, '<started_at>', 1);
```

### 4) เข้า phpMyAdmin ให้ถูกทาง (สำคัญ)

**ห้ามเข้า URL `http://<ip>:8880/phpMyAdmin/` ตรงๆ ในแท็บ/เบราว์เซอร์ใหม่** — จะเจอ error `Cannot connect: invalid settings` เพราะ phpMyAdmin ต้องได้ session ที่ Plesk brokered ให้ก่อน

**ทางที่ถูก:**
Plesk (`http://14.207.143.39:8880/`) → login → **Websites & Domains** → `runludtong.com` → **Databases** → แถว `runludtong` → คลิกไอคอน **phpMyAdmin** (จะเปิดแท็บใหม่พร้อม session ที่ใช้งานได้จริง)

### 5) รัน SQL

phpMyAdmin → เลือกฐานข้อมูล `runludtong` (ต้องเป็นฐานนี้ ไม่ใช่ฐานอื่น) → แท็บ **SQL** → วาง SQL จากขั้นตอน 3 → กด **Go**

### 6) ตรวจสอบผล

- แท็บ **Structure** ของตารางที่แก้ → เช็คว่าคอลัมน์ใหม่ขึ้นจริง ชนิดข้อมูลถูกต้อง
- ตาราง `_prisma_migrations` → จำนวนแถวเพิ่มขึ้นตรงกับจำนวน migration ที่เพิ่งใส่ไป
- เข้าเว็บจริง ทดสอบฟีเจอร์ที่พึ่งฟิลด์ใหม่ ว่าใช้งานได้จริงไม่มี error 500

## ประวัติการรัน migration บน production

| วันที่ | Migration | หมายเหตุ |
|---|---|---|
| 2569-09-01 | ทั้งหมด 19 migration แรก (schema เริ่มต้นจนถึง `add_shipping_delivery_option`) | Import ผ่าน phpMyAdmin Import tab ทีเดียว (ไฟล์ SQL รวม + bookkeeping) — ตอนนั้นฐานข้อมูล `runludtong` ยังว่างเปล่า |
| 2569-09-02 | `add_dob_toggle_and_health_confirm`, `replace_health_confirmed_with_medical_condition` | รันผ่าน SQL tab ตามขั้นตอนในเอกสารนี้ — มีข้อมูลจริงอยู่แล้วตอนรัน (Registration/User มีข้อมูล) ไม่กระทบเพราะเป็นแค่ ALTER TABLE เพิ่ม/ลบคอลัมน์ |

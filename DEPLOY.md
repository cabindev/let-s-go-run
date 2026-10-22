# Deploy runludtong.com

ขั้นตอนขึ้นเว็บจริงบน Plesk VPS — คำสั่งเดียวจบ: ดึงโค้ด → ติดตั้ง → migrate → build → รีสตาร์ท

> **สำหรับ AI agent (Claude):** เมื่อผู้ใช้สั่ง "deploy" ในโปรเจคนี้ ให้ทำตาม [ขั้นตอนสำหรับ agent](#ขั้นตอนสำหรับ-agent) ด้านล่าง

## ภาพรวม

```
เครื่อง dev ──git push──► GitHub (cabindev/let-s-go-run, branch main)
                              │
            Plesk Git (repo "let-s-go-run", โหมด pull) ดึงแล้วคัดลอกลง /httpdocs
                              │
      scripts/deploy-plesk.sh : npm ci → prisma migrate deploy → npm run build → tmp/restart.txt
                              │
              Passenger (Node 26) รัน server.js — env มาจาก Plesk
```

| อะไร | อยู่ไหน |
|---|---|
| เซิร์ฟเวอร์ | `ssh runludtong` (root, key `~/.ssh/id_runludtong`) — IP 14.207.143.39 |
| โค้ดที่รันจริง | `/var/www/vhosts/runludtong.com/httpdocs` (ไม่ใช่ git checkout — Plesk Git คัดลอกมาให้) |
| Plesk Git repo | `/var/www/vhosts/runludtong.com/git/let-s-go-run` |
| ค่า env (ลับ) | Plesk → runludtong.com → Node.js → Custom environment variables (ไม่มีไฟล์ `.env` บนเซิร์ฟเวอร์) |
| Node | `/opt/plesk/node/26/bin/node` |
| log ของแอป | `/var/log/passenger/passenger.log` |

## คำสั่ง

```bash
# 1) บนเครื่อง dev — โค้ดต้องอยู่บน GitHub ก่อน
git push

# 2) ตรวจก่อน (ไม่แก้อะไร): ดึงข้อมูลจาก GitHub, บอก commit ล่าสุด, migration ที่ค้าง
ssh runludtong 'bash /var/www/vhosts/runludtong.com/httpdocs/scripts/deploy-plesk.sh --check'

# 3) deploy จริง
ssh runludtong 'bash /var/www/vhosts/runludtong.com/httpdocs/scripts/deploy-plesk.sh'
```

ใช้เวลาราว 1–3 นาที บรรทัดสุดท้ายต้องเป็น `deploy เสร็จ — https://runludtong.com ตอบ 200`

## ขั้นตอนสำหรับ agent

1. **เช็คโค้ดบนเครื่อง** — `git status` ถ้ามีไฟล์แก้ค้างที่ยังไม่ commit ให้ **ถามผู้ใช้ก่อน** ว่าจะ commit ด้วยไหม (อย่า commit เอง)
   deploy จะขึ้นเฉพาะสิ่งที่ push ขึ้น GitHub แล้ว
2. typecheck + lint ผ่าน (`npx tsc --noEmit`, `npx eslint`) แล้ว `git push`
3. รัน `--check` ดูว่ามี migration ค้างไหม — **ถ้ามี migration ใหม่ แจ้งผู้ใช้ก่อน** ว่าจะแก้ฐานข้อมูลจริงอะไร
   (เว็บนี้รับเงินจริงผ่าน Stripe — ดู `docs/production-migrations.md`)
4. รัน deploy เป็นงานเบื้องหลังแยกจาก SSH (build ใช้เวลา ถ้า SSH หลุด deploy จะไม่ถูกตัดกลางทาง):
   ```bash
   ssh runludtong 'setsid bash /var/www/vhosts/runludtong.com/httpdocs/scripts/deploy-plesk.sh > /root/deploy-runludtong.log 2>&1 < /dev/null & disown'
   ssh runludtong 'tail -f /root/deploy-runludtong.log'   # รอจนเห็น "deploy เสร็จ"
   ```
5. ตรวจหน้าจริง: `/`, `/events`, `/auth/signin` ต้องตอบ 200 และรูปใน `/uploads/...` ต้องเปิดได้
6. รายงานผู้ใช้: commit ที่ขึ้น, migration ที่รัน (ถ้ามี), ผลตรวจ

## ข้อควรรู้

- **ระหว่าง build เว็บอาจตอบ 500 ชั่วคราว** ถ้า build ล้ม เว็บจะพังจนกว่าจะ deploy สำเร็จ — ดูข้อความ error ใน log แล้วแก้/deploy ใหม่
- **IPv6 ของ VPS เสียเป็นบางช่วง** (เจอหลังรีบูต) — สคริปต์บังคับ IPv4 ให้แล้ว ถ้า `npm ci` ล้มด้วย `EHOSTUNREACH` ให้รันใหม่
- **ห้าม commit ไฟล์ dump ฐานข้อมูล** (`*.sql` ที่ root ถูก ignore แล้ว) — Plesk คัดลอกทุกไฟล์ใน repo ลง httpdocs
- เปลี่ยนค่า env ใน Plesk แล้วต้อง Restart App (หรือ deploy ใหม่ถ้าค่านั้นถูกใช้ตอน build)
- Plesk Git ตั้ง "Deployment mode: auto" — push ขึ้น GitHub แล้ว Plesk อาจคัดลอกโค้ดลง httpdocs เอง (ถ้า webhook ทำงาน) แต่**จะยังไม่ build** ต้องรันสคริปต์นี้เสมอ

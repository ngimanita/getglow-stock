# GETGLOW Stock

ระบบจัดการสต๊อกยาฉีด (โบท็อกซ์และฟิลเลอร์) สำหรับ GETGLOW Clinic — Next.js (App Router) + TypeScript + Prisma/SQLite + Tailwind CSS, ตามดีไซน์ใน `design_handoff_getglow_stock/`.

## เริ่มใช้งาน (dev)

```bash
npm install
npm run db:push    # สร้างฐานข้อมูล SQLite ตาม prisma/schema.prisma
npm run db:seed     # ใส่ข้อมูลตัวอย่าง (สินค้าจริง 6 ตัว + demo อีก 6 ตัว + ผู้ใช้ 3 คน)
npm run dev
```

เปิด <http://localhost:3000> — ระบบจะพาไปหน้า `/login` อัตโนมัติ

**ผู้ใช้ทดสอบ (seed data):**

| ชื่อ | PIN | บทบาท |
|---|---|---|
| หมองิ้ม | 1234 | เจ้าของ (หลังบ้าน) |
| น้องมิ้น (คลังยา) | 1111 | คลังยา (หน้าบ้าน) |
| น้องเบล (คลังยา) | 2222 | คลังยา (หน้าบ้าน) |

## คำสั่งอื่นๆ

```bash
npm test            # รัน unit tests ของ business logic (src/lib/metrics.test.ts)
npm run test:watch  # รันเทสต์แบบ watch
npm run build        # production build
npm run db:studio    # เปิด Prisma Studio ดูข้อมูลในฐานข้อมูล
```

## โครงสร้างสำคัญ

- `src/lib/metrics.ts` — business logic ทั้งหมด (usage rate, reorder date, FEFO, price analysis ฯลฯ) พอร์ตมาจาก logic class ใน `design_handoff_getglow_stock/design/GETGLOW Stock.dc.html` แบบ 1:1 — ถ้าจะแก้สูตรคำนวณ ต้องแก้ที่นี่และอัปเดตเทสต์คู่กัน
- `src/lib/metrics.test.ts` — เทสต์ครอบคลุมทุกฟังก์ชันคำนวณ (42 tests)
- `prisma/schema.prisma` — data model (Product, Lot, StockCount, Setting, User, Supplier, AuditLog)
- `prisma/seed.ts` — seed data จริงของคลินิก (6 สินค้า) + demo เพิ่ม (6 สินค้ารวม 2 ตัวที่เป็นเครื่อง/shot)
- `src/app/(app)/` — 6 หน้าจอหลัก (ภาพรวม, รับเข้าล็อต, นับสต๊อก, เทียบราคา, แจ้งเตือน, ตั้งค่า)
- `src/middleware.ts` — บังคับ login + จำกัดสิทธิ์หน้า owner-only ระดับ server (ไม่ใช่แค่ซ่อน nav)

## หมายเหตุจากการ seed

ล็อตของ 6 สินค้าจริง (Neuronox, Nabota, Neuramis) **ไม่มีวันหมดอายุ** และล็อตของ Nabota ทั้ง 2 ขนาด **ไม่มีวันที่ซื้อ** เพราะไม่มีข้อมูลนี้ตอนส่งมา — ระบบจะไม่เดาให้ (จะกระทบการเตือนหมดอายุ/FEFO ผิดได้) หน้า **แจ้งเตือน** มีรายการ "ล็อตที่ยังไม่ระบุวันหมดอายุ" ไว้เตือนให้กรอกเพิ่มทีหลัง

ตัวเลข "อัตราการใช้ต่อเดือน" เริ่มต้นของ 4 สินค้าจริงที่มีวันที่ซื้อ คำนวณจาก (ซื้อสะสม − คงเหลือ) ÷ จำนวนวันตั้งแต่ซื้อครั้งแรกถึงวันนับล่าสุด — เป็นแค่ค่าเริ่มต้น ระบบจะคำนวณใหม่ให้แม่นขึ้นทุกครั้งที่นับสต๊อกรอบถัดไป (ดู rule การถ่วงน้ำหนักใน `metrics.ts`)

## ยังไม่ได้ทำ (ตามดีไซน์ที่ระบุว่าต้องเพิ่มสำหรับ production)

- PWA icons จริง (มี `public/manifest.webmanifest` แล้วแต่ยังไม่มีไฟล์ไอคอน — ต้องขอโลโก้จริงจากทีมแบรนด์)
- Offline queue สำหรับหน้านับสต๊อก (ตอนนี้ต้องมีเน็ตตอนกดบันทึก)
- Audit log UI (มีการบันทึกลง `AuditLog` table ทุกการกระทำสำคัญแล้ว แต่ยังไม่มีหน้าดูย้อนหลัง)

## Deploy

โปรเจกต์นี้ตั้งค่าให้ใช้ SQLite ไฟล์เดียว (`prisma/dev.db`) ซึ่งเหมาะกับรันบนเครื่อง/เซิร์ฟเวอร์ที่มี persistent disk (เช่น VPS, Railway, Fly.io) ถ้าจะ deploy บน Vercel (serverless, ไม่มี persistent disk) ต้องเปลี่ยน `datasource` ใน `prisma/schema.prisma` เป็น Postgres (เช่น Supabase/Neon) แล้วรัน `npm run db:push` ใหม่กับ `DATABASE_URL` ของ Postgres — โค้ดส่วนอื่นไม่ต้องแก้เพราะ Prisma abstraction เหมือนกัน

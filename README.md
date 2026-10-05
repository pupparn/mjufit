# MJU FitPass

ระบบซื้อตั๋วเข้าฟิตเนส (Day Pass) ออนไลน์ สำหรับนักศึกษามหาวิทยาลัยแม่โจ้ — นักศึกษาซื้อตั๋วและจ่ายผ่าน PromptPay ได้จากมือถือ
ไม่ต้องเดินไปซื้อกับคนขาย ส่วนเจ้าหน้าที่ตรวจสลิป สแกนเข้าประตู และดูสถิติผ่าน Dashboard

> **โปรเจกต์ portfolio ส่วนตัว — ไม่ใช่ระบบทางการของมหาวิทยาลัยแม่โจ้** ห้ามใช้โลโก้หรือตรามหาวิทยาลัย

- เว็บที่ใช้งานอยู่: <https://mjufit.vercel.app>
- Spec ฉบับเต็ม: [mjufitpass/SPEC.md](mjufitpass/SPEC.md)
- Flowchart ทุก flow: [docs/flowchart.html](docs/flowchart.html) (เปิดใน browser)

---

## สารบัญ

1. [ระบบทำอะไรได้บ้าง](#ระบบทำอะไรได้บ้าง)
2. [Tech stack](#tech-stack)
3. [โครงสร้าง repo](#โครงสร้าง-repo)
4. [ติดตั้งและรันบนเครื่องตัวเอง](#ติดตั้งและรันบนเครื่องตัวเอง)
5. [คำสั่งที่ใช้บ่อย](#คำสั่งที่ใช้บ่อย)
6. [การมีส่วนร่วม: งานเอกสาร](#การมีส่วนร่วม-งานเอกสาร)
7. [ข้อควรระวัง](#ข้อควรระวัง)

---

## ระบบทำอะไรได้บ้าง

| บทบาท | ทำอะไรได้ |
|---|---|
| **นักศึกษา** | ล็อกอินด้วย Google → ยอมรับ PDPA → ลงทะเบียน (รหัสนักศึกษา ชื่อ คณะ ชั้นปี) → ซื้อ Day Pass ของวันนี้ → สแกน QR PromptPay จ่าย 20 บาท → อัปโหลดสลิป → ได้ตั๋วพร้อม QR เข้าประตู |
| **Staff** | ตรวจสลิปที่มีปัญหา (อนุมัติ / ปฏิเสธ) · ยกเลิกตั๋ว · บันทึกการคืนเงิน · ใช้ Gate Kiosk สแกนเข้าประตู · ดู Dashboard และ export รายชื่อผู้ซื้อเป็น CSV |
| **Super admin** | ทุกอย่างของ staff + เพิ่ม/ลบ staff + แก้ราคา เวลาทำการ และวันปิดพิเศษ |

จุดเด่นทางเทคนิค:

- **ตรวจสลิปอัตโนมัติ** ผ่าน Slip2Go (หรือโหมด mock สำหรับเดโม) — ผ่านแล้วออกตั๋วทันที ไม่ผ่านเข้าคิวให้ staff ตรวจ
- **QR เข้าประตูแบบ TOTP** เปลี่ยนทุก 30 วินาที ภาพหน้าจอเก่าใช้ไม่ได้ มีรหัสสำรอง 6 หลักไว้พิมพ์แทน
- **Audit log** ทุกการกระทำของ staff ต้องกรอกเหตุผลและบันทึกไว้
- **เวลาไทยทั้งระบบ** (server รันเป็น UTC) และมี dev clock ไว้จำลองเวลาตอนทดสอบ

## Tech stack

- **Next.js 16** (App Router) + TypeScript — ⚠️ มี breaking changes จากเวอร์ชันเก่า อ่าน [mjufitpass/AGENTS.md](mjufitpass/AGENTS.md) ก่อนแก้โค้ด
- **Supabase** — Postgres, Auth (Google), Storage (เก็บสลิป), Realtime (อัปเดตสถานะออเดอร์)
- **Tailwind CSS v4** + shadcn/ui
- **Vitest** (unit test) + **Playwright** (E2E)
- **Vercel** (hosting)

## โครงสร้าง repo

```
mjufit/
├── README.md              ← ไฟล์นี้
├── docs/                  เอกสารโปรเจกต์ (flowchart, handoff notes, เอกสารที่จะเขียนเพิ่ม)
└── mjufitpass/            ตัวแอป Next.js
    ├── SPEC.md            spec ที่ตกลงกันไว้ (อ่านอันนี้ก่อน)
    ├── README.md          คู่มือ setup ฝั่งนักพัฒนาแบบละเอียด (Supabase, Google OAuth, Slip2Go)
    ├── src/app/           หน้าเว็บแต่ละหน้า
    ├── src/lib/           business logic (ส่วนใหญ่เป็น pure function มี test)
    ├── src/messages/th.ts ข้อความภาษาไทยทั้งหมดในแอป
    ├── supabase/migrations/  schema ของ database
    └── e2e/               Playwright test
```

> **หมายเหตุ:** โค้ดใน `mjufitpass/` ถูก mirror ไปที่ [pupparn/mjufitdaypass](https://github.com/pupparn/mjufitdaypass) ซึ่ง Vercel ใช้ deploy
> ให้ทำงานและเปิด PR ที่ repo นี้ (`pupparn/mjufit`) เท่านั้น

## ติดตั้งและรันบนเครื่องตัวเอง

### สิ่งที่ต้องมี

- [Node.js 24](https://nodejs.org) (เช็คด้วย `node -v`)
- Git
- ไฟล์ `.env.local` — **ขอจากเจ้าของโปรเจกต์** (ส่งให้แยกเป็นไฟล์ ไม่อยู่ใน repo)
- (ทางเลือก) [Docker Desktop](https://www.docker.com/products/docker-desktop/) ถ้าจะรัน database บนเครื่องตัวเอง

### 1. Clone และติดตั้ง package

```bash
git clone https://github.com/pupparn/mjufit.git
```
```bash
cd mjufit/mjufitpass
```
```bash
npm install
```

### 2. วางไฟล์ env

นำไฟล์ `.env.local` ที่ได้รับมาวางไว้ที่ `mjufit/mjufitpass/.env.local`

- ไฟล์นี้มี secret key — **ห้าม commit, ห้ามแชร์ในแชทกลุ่มหรือ issue** (`.gitignore` กันไว้แล้ว)
- ดูว่ามีตัวแปรอะไรบ้างได้ที่ [mjufitpass/.env.example](mjufitpass/.env.example)

### 3. รัน

```bash
npm run dev
```

เปิด <http://localhost:3000> แล้วล็อกอินด้วย Google

- **ต้องใช้ port 3000** เพราะ Google login อนุญาต redirect กลับมาที่ `localhost:3000` เท่านั้น
- ล็อกอินครั้งแรกจะเป็น **นักศึกษา** ถ้าต้องการดูหน้า staff ให้แจ้ง super admin เพิ่มอีเมลในหน้า "จัดการ Staff"
- ตอน dev จะมีปุ่ม 🕒 มุมขวาล่างไว้จำลองเวลา เช่น ทดสอบหลังเวลาปิดขาย (มีผลเฉพาะ browser ของเรา)

### 4. ตรวจว่าทุกอย่างผ่าน (ก่อนเปิด PR ที่แก้โค้ด)

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## คำสั่งที่ใช้บ่อย

รันใน `mjufitpass/`

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | รันเว็บที่ <http://localhost:3000> |
| `npm test` | unit test |
| `npm run lint` | ตรวจรูปแบบโค้ด |
| `npm run typecheck` | ตรวจ type |
| `npm run build` | build แบบ production |
| `npm run test:e2e` | E2E test (ต้องมี Docker และรัน `npx supabase start` ก่อน — ดู [mjufitpass/README.md](mjufitpass/README.md)) |

## การมีส่วนร่วม: งานเอกสาร

ทีมเอกสารรับผิดชอบเขียนคู่มือและอธิบายระบบ เอกสารใหม่ทั้งหมดอยู่ในโฟลเดอร์ `docs/`

### เอกสารที่ต้องการ (ร่าง — ปรับได้)

| เอกสาร | ไฟล์ | กลุ่มผู้อ่าน | ผู้รับผิดชอบ |
|---|---|---|---|
| คู่มือนักศึกษา: ซื้อตั๋ว จ่ายเงิน ใช้ QR เข้าประตู | `docs/user-guide-student.md` | นักศึกษา | _TBD_ |
| คู่มือเจ้าหน้าที่: คิวสลิป คืนเงิน Gate Kiosk Dashboard | `docs/user-guide-staff.md` | staff / super admin | _TBD_ |
| ภาพรวมสถาปัตยกรรมและ database (ตาราง, RLS, RPC) | `docs/architecture.md` | นักพัฒนา | _TBD_ |
| FAQ และการแก้ปัญหา (สลิปไม่ผ่าน, QR หมดอายุ, กล้องไม่ทำงาน) | `docs/faq.md` | ทุกคน | _TBD_ |

### ขั้นตอนการทำงาน

1. เลือกเอกสารจากตารางด้านบน แล้วเปิด **Issue** บอกว่ากำลังทำอันไหน (กันทำซ้ำกัน)
2. สร้าง branch จาก `master` ตั้งชื่อเช่น `docs/user-guide-student`
   ```bash
   git checkout -b docs/user-guide-student
   ```
3. เขียนเอกสารเป็น Markdown ใน `docs/` (ภาพประกอบเก็บใน `docs/images/`)
4. Commit แล้ว push branch ขึ้นไป
   ```bash
   git push -u origin docs/user-guide-student
   ```
5. เปิด **Pull Request** เข้า `master` แล้วขอ review จากเจ้าของโปรเจกต์อย่างน้อย 1 คน

### แนวทางการเขียน

- **ภาษาไทยเป็นหลัก** ใช้ศัพท์เทคนิคภาษาอังกฤษได้ (เช่น QR, slip, Dashboard) ให้ตรงกับที่แอปใช้ใน [src/messages/th.ts](mjufitpass/src/messages/th.ts)
- **ยึด [SPEC.md](mjufitpass/SPEC.md) และพฤติกรรมของเว็บจริง** ถ้าสองอย่างนี้ไม่ตรงกัน ให้แจ้งใน Issue แทนการเดาเอง
- **ภาพหน้าจอห้ามมีข้อมูลส่วนบุคคลจริง** (ชื่อ รหัสนักศึกษา อีเมล รูปสลิป) — ใช้บัญชีทดสอบ หรือเบลอก่อน commit
- **ห้ามใส่ secret ในเอกสาร** เช่น key ใน `.env.local` หรือเบอร์ PromptPay จริง
- เอกสารแต่ละไฟล์ขึ้นต้นด้วยหัวข้อ, ผู้อ่านเป้าหมาย และวันที่อัปเดตล่าสุด
- ถ้าต้องอธิบาย flow ให้อ้างอิงหรือใช้ Mermaid แบบเดียวกับ [docs/flowchart.html](docs/flowchart.html)

## ข้อควรระวัง

- **`.env.local` ชี้ไปที่ database ตัวเดียวกับเว็บจริง** ทุกอย่างที่ทำบน localhost (ซื้อตั๋ว, อนุมัติสลิป, แก้ settings) จะเกิดขึ้นกับข้อมูลจริงทันที
  - ถ้าแค่ต้องการดูหน้าเว็บเพื่อเขียนเอกสาร ให้ดูอย่างเดียว หรือถามเจ้าของโปรเจกต์ก่อนลองกดปุ่มที่แก้ข้อมูล
  - **ห้ามโอนเงินจริง** เพื่อทดสอบ ถ้าจำเป็นต้องทดสอบการจ่ายเงินให้ประสานกับเจ้าของโปรเจกต์
- ภาพหน้าจอที่มีข้อมูลนักศึกษาจริงจาก Dashboard ห้ามเผยแพร่ (PDPA)
- พบปัญหาหรือเอกสารไม่ตรงกับเว็บ → เปิด Issue

# MJU FitPass

ซื้อตั๋วเข้าฟิตเนส (Day Pass) ออนไลน์ สำหรับนักศึกษามหาวิทยาลัยแม่โจ้ — โปรเจกต์ portfolio ส่วนตัว
ไม่ใช่ระบบทางการของมหาวิทยาลัย

- Spec: [SPEC.md](SPEC.md)
- Flowchart: [../docs/flowchart.html](../docs/flowchart.html)

Stack: Next.js 16 (App Router) · TypeScript · Supabase · Tailwind v4 · shadcn/ui · Vitest

## Setup (ครั้งแรก)

### 1. สร้าง Supabase project
1. สร้าง project ใหม่ที่ <https://supabase.com/dashboard>
2. **Project Settings → API** คัดลอก Project URL, publishable key และ secret key

### 2. ตั้ง Google OAuth
1. ใน [Google Cloud Console](https://console.cloud.google.com/apis/credentials) สร้าง **OAuth client ID** ชนิด *Web application*
2. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
3. ใน Supabase → **Authentication → Sign In / Providers → Google** เปิดใช้งาน แล้วใส่ Client ID / Secret
   - **ปิด provider Email** ในหน้าเดียวกัน — role ดูจากอีเมลใน token ถ้าเปิด Email signup ไว้ ใครก็สมัครด้วยอีเมล super admin ได้
4. Supabase → **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000` (เปลี่ยนเป็น URL ของ Vercel ตอน deploy)
   - Redirect URLs: เพิ่ม `http://localhost:3000/auth/callback` (และ URL production ภายหลัง)

### 3. Environment
```bash
cp .env.example .env.local
```
แล้วกรอกค่าใน `.env.local`

### 4. Database
migration สร้างตาราง, RLS และ bucket `slips` (private) ให้ครบ
```bash
npx supabase login
```
```bash
npx supabase link --project-ref <project-ref>
```
```bash
npx supabase db push
```

### 5. ตรวจสลิป (เลือกอย่างใดอย่างหนึ่ง)
- **เดโม:** `SLIP_VERIFIER=mock` — อัปโหลดรูปอะไรก็ได้ แล้วเลือกผลเอง (ผ่าน / ไม่ผ่าน / สลิปซ้ำ)
- **ของจริง:** `SLIP_VERIFIER=slip2go`
  1. สมัคร [Slip2Go](https://slip2go.com) แล้วเปิด **API Connect** ใน [dashboard](https://app.slip2go.com)
  2. ตั้ง `SLIP2GO_API_URL=https://connect.slip2go.com` และคัดลอก **Secret Key** ใส่ `SLIP2GO_SECRET_KEY`
  3. ถ้าตั้ง IP Whitelist ไว้ ต้องอนุญาต IP ของ server (Vercel ไม่มี IP คงที่ → ปล่อยเป็น `*`)
  4. แอปส่งเงื่อนไขให้ Slip2Go ตรวจทุกสลิป: สลิปซ้ำ · ผู้รับ = `PROMPTPAY_ID` · ยอดตรงเป๊ะ — วันที่โอนแอปตรวจเองตามเวลาไทย
  5. รองรับเฉพาะรูป **JPG / PNG** (Slip2Go ไม่รับ WEBP)

`PROMPTPAY_ID` (เบอร์โทรหรือเลขบัตรประชาชน) ใช้สร้าง QR ที่ล็อกยอดเงิน

> ⚠️ **Deploy เดโมสาธารณะ (mock):** QR ถอดรหัสกลับเป็น `PROMPTPAY_ID` ได้ ให้ใช้ **เบอร์ปลอม** (เช่น `0800000000`) ห้ามใช้เลขบัตรประชาชนหรือเบอร์จริง หน้าเว็บจะแสดงป้าย "ห้ามโอนเงินจริง" ในโหมด mock

**Vercel:** ตั้ง env ทั้งหมดใน Project Settings รวม `SUPABASE_SECRET_KEY` (server ใช้ตอนรันจริงแล้ว ไม่ใช่แค่ seed) · ขนาดสลิปจำกัด 4 MB เพราะ Vercel รับ request body ได้ไม่เกิน 4.5 MB

### 6. Seed super admin
```bash
npm run seed
```
ใส่ `SUPER_ADMIN_EMAIL` ลงตาราง `staff_members` (ทำก่อนหรือหลังล็อกอินครั้งแรกก็ได้)

### 7. Run
```bash
npm run dev
```

## Dev clock (ทดสอบเรื่องเวลา)

ตอน `npm run dev` จะมีปุ่ม 🕒 มุมขวาล่าง ใช้จำลองเวลา (เวลาไทย) เพื่อทดสอบการปิดขาย 19:30, วันปิด, ออเดอร์หมดอายุ
โดยไม่ต้องรอ — เลือก preset หรือกำหนดวัน-เวลาเอง แล้วกด "Reset to real time" เพื่อกลับเวลาจริง

- เก็บเป็น offset ใน cookie ของ browser นั้น เวลาจำลองจึงเดินต่อ และไม่กระทบคนอื่น
- ทำงานเฉพาะ `next dev` เท่านั้น (production ไม่อ่าน cookie นี้)
- ไม่กระทบ timestamp ที่ DB บันทึก (`created_at`, `updated_at`) ซึ่งยังเป็นเวลาจริง

## Scripts

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | dev server |
| `npm test` | unit tests (Vitest) |
| `npm run typecheck` | generate route types + `tsc` |
| `npm run lint` | ESLint |
| `npm run build` | production build (ไม่ต้องมี env จริง) |
| `npm run seed` | ตั้ง super admin จาก `SUPER_ADMIN_EMAIL` |

## โครงสร้างหลัก

```
src/
  proxy.ts                    refresh session + เด้งคนที่ยังไม่ล็อกอินไป /login
  lib/auth/access.ts          กติกา "ใครอยู่หน้าไหน" (pure, มี test)
  lib/auth/viewer.ts          getViewer() / requireArea() ฝั่ง server
  lib/student-id.ts           ตรวจรูปแบบรหัสนักศึกษา (ตรงกับ CHECK ใน DB)
  lib/registration.ts         ฟอร์มลงทะเบียน + รายชื่อคณะ (pure, มี test)
  lib/time.ts, sales.ts       เวลาไทย + กติกาการขาย (pure, มี test)
  lib/orders.ts               สร้างออเดอร์ / ส่งสลิป (server-only)
  lib/tickets/                QR เข้าประตู (TOTP) + กติกาตั๋วใช้ได้/หมดอายุ (pure, มี test)
  lib/payments/               SlipVerifier (slip2go, mock), assess, PromptPay QR
  lib/supabase/               client / server / proxy helpers + types
  messages/th.ts              ข้อความภาษาไทยทั้งหมด
  app/
    login/                    Google sign-in
    auth/callback, signout    OAuth callback, sign-out
    onboarding/consent        PDPA consent
    onboarding/register       ลงทะเบียน: รหัส ชื่อ นามสกุล คณะ ชั้นปี (ครั้งเดียว)
    me/                       หน้านักศึกษา + ปุ่มซื้อ Day Pass
    orders/[id]/              QR ชำระเงิน, อัปโหลดสลิป, สถานะ realtime
    ticket/                   Day Pass + QR เข้าประตูแบบหมุนทุก 30 วินาที + รหัสสำรอง
    dashboard/                หน้า staff
supabase/migrations/          schema + RLS + RPCs
scripts/seed-super-admin.ts
```

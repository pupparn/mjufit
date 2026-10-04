# MJU FitPass — Spec

ระบบซื้อตั๋วเข้าฟิตเนส (Day Pass) ออนไลน์ สำหรับนักศึกษามหาวิทยาลัยแม่โจ้
แทนการเดินไปซื้อตั๋วกับคนขาย และให้ staff ตรวจสอบการชำระเงินและดูข้อมูลผ่าน Dashboard

> **สถานะ:** โปรเจกต์ portfolio ส่วนตัว — **ไม่ใช่ระบบทางการของมหาวิทยาลัยแม่โจ้**
> ห้ามใช้โลโก้/ตรามหาวิทยาลัย และทุกหน้ามี footer แจ้งข้อความนี้

Flowchart: [`../docs/flowchart.html`](../docs/flowchart.html)

---

## 1. Stack

- Next.js (App Router, v16 — ใช้ `proxy.ts` แทน middleware) + TypeScript
- Supabase: Postgres, Auth (Google), Storage (สลิป), Realtime (สถานะออเดอร์)
- Tailwind CSS v4 + shadcn/ui
- Deploy: Vercel
- Tests: Vitest (domain logic) + Playwright (E2E flow หลัก 1 เส้น)

UI ภาษาไทยอย่างเดียว ข้อความรวมอยู่ใน `src/messages/th.ts` (พร้อมทำ i18n ภายหลัง)
ฝั่งนักศึกษา mobile-first · Dashboard desktop-first · Kiosk เต็มจอบนแท็บเล็ต

## 2. ผู้ใช้และสิทธิ์

| บทบาท | ได้สิทธิ์อย่างไร | ทำอะไรได้ |
|---|---|---|
| Student | Google Login ด้วย Gmail ใดก็ได้ | ซื้อตั๋ว ดูตั๋ว/QR ดูประวัติ |
| Staff | Super admin เพิ่มอีเมลในระบบ | คิวสลิป ยกเลิกตั๋ว บันทึกคืนเงิน Dashboard ใช้ Kiosk |
| Super admin | seed จาก env `SUPER_ADMIN_EMAIL` | ทุกอย่างของ staff + จัดการ staff + แก้ settings (ราคา เวลาทำการ วันปิด) |

- Role ไม่เก็บใน `profiles` — ดูจากตาราง allowlist `staff_members(email, role)` ผ่านฟังก์ชัน `current_staff_role()`
- Staff/super admin ข้ามขั้น onboarding และเข้า Dashboard ทันที
- **ไม่มีการจำกัดโดเมนอีเมล** → ระบบไม่ได้ยืนยันว่าเป็นนักศึกษาจริง (ยอมรับได้สำหรับ portfolio;
  ถ้าจะใช้จริงให้เพิ่ม Microsoft Login จำกัดโดเมนมหาวิทยาลัยภายหลัง)

### Onboarding นักศึกษา (ล็อกอินครั้งแรก)
1. ยอมรับ PDPA consent
2. ลงทะเบียน: รหัสนักศึกษา · ชื่อ · นามสกุล · คณะ (dropdown) · ชั้นปี (1–8)
   - ชื่อ-นามสกุล prefill จากชื่อบัญชี Google แก้ได้
   - รหัสนักศึกษา: รูปแบบ `^\d{8,10}$` (trim ก่อนตรวจ) · ห้ามซ้ำ (unique index)
   - ตรวจทั้งฝั่ง server (zod) และ DB (CHECK + RPC `register_student`)
   - ลงทะเบียนครั้งเดียวแล้วล็อกทั้งหมด แก้ได้โดย staff เท่านั้น
   - รายชื่อคณะอยู่ใน `src/lib/registration.ts` (DB ไม่ล็อกค่า แก้รายชื่อได้โดยไม่ต้อง migrate) — **ต้องตรวจกับรายชื่อทางการของมหาวิทยาลัย**
   - ผู้ใช้เก่าที่กรอกรหัสไว้แล้ว: ต้องกรอกข้อมูลที่เหลือ โดยรหัสเดิมถูกล็อกไว้
- ข้อมูลที่เก็บ: อีเมล · รหัสนักศึกษา · ชื่อ-นามสกุล · คณะ · ชั้นปี · เวลาที่ให้ consent — เท่านั้น

## 3. Day Pass

- ราคา **20 บาท** (super admin แก้ได้)
- ซื้อได้ **เฉพาะวันนี้** ซื้อล่วงหน้าไม่ได้ · **1 ใบ/คน/วัน** · ซื้อให้คนอื่นไม่ได้
- เข้า-ออกได้ **ไม่จำกัดครั้ง** ในวันนั้น (บันทึกทุกการสแกน)
- เวลาทำการ default **08:00–20:00** (ตั้งค่าได้) · ปิดขาย **19:30** · ตั๋วหมดอายุ **20:00**
- วันปิดพิเศษ: super admin ตั้งได้ → ปิดการขาย
- ออเดอร์ที่ยังไม่อัปโหลดสลิปหมดอายุใน **15 นาที**

## 4. การชำระเงิน

1. สร้าง PromptPay QR ล็อกยอด 20 บาท (บัญชีผู้รับอยู่ใน env)
2. นักศึกษาโอนแล้วอัปโหลดสลิป
3. `SlipVerifier` (interface) — เลือก implementation ด้วย env `SLIP_VERIFIER`
   - `slip2go`: Slip2Go API จริง (อัปโหลดรูป) ส่งเงื่อนไข checkDuplicate · checkReceiver (= `PROMPTPAY_ID`) · checkAmount (eq)
   - `mock`: สำหรับ deploy เดโม — อัปโหลดรูปใดก็ได้ แล้วเลือกผลเอง (ผ่าน / ไม่ผ่าน / สลิปซ้ำ)
4. ผ่าน → ออกตั๋วทันที · ไม่ผ่าน/API ล่ม → คิว staff (`needs_review`)
   - **ยกเว้น** รูปที่ไม่ใช่สลิปหรืออ่านไม่ได้ (Slip2Go 400001 ไม่พบ QR, 400002 ไฟล์ไม่ถูกต้อง) → ให้อัปโหลดใหม่ในออเดอร์เดิม ไม่เข้าคิว staff
   - แอปตรวจซ้ำเองด้วย: ยอดตรงกับราคาที่ล็อกไว้ในออเดอร์ และวันที่โอน (เวลาไทย) ตรงกับวันของออเดอร์
   - บันทึกผล + ออกตั๋วใน transaction เดียว (`record_slip_result`)
5. นักศึกษาเห็นสถานะ realtime (ไม่มีอีเมลแจ้งเตือน)

### Edge cases
- Staff อนุมัติหลัง 20:00 ของวันออเดอร์ → ตั๋ว `expired` ทันที + ติดธง "ต้องคืนเงิน"
- ปฏิเสธ/ยกเลิกตั๋วที่จ่ายจริงแล้ว → คืนเงินนอกระบบ แล้ว staff กด "คืนเงินแล้ว" + หมายเหตุ
- ทุกการกระทำของ staff บันทึกเหตุผล (audit log)

## 5. QR และ Gate Kiosk (mockup ประตูอัตโนมัติ)

- หน้า `/ticket`: QR แบบ TOTP — มือถือได้ secret ของตั๋ว (`tickets.totp_secret`, อ่านได้เฉพาะเจ้าของผ่าน RLS) แล้วสร้าง QR เองทุก 30 วินาที (ใช้ได้แม้ไม่มีเน็ต เมื่อเปิดหน้าไว้แล้ว) + นาฬิกาเดินสด ให้เห็นชัดว่าเป็นภาพหน้าจอเก่า
- Payload: `MJUFP1.<ticketId>.<step>.<base64url(HMAC-SHA256(secret, "<ticketId>.<step>")[0..16])>` · step = 30 วินาที
- รหัสสำรอง 6 หลัก (HMAC แยก message) เปลี่ยนทุก 30 วินาที — ใช้คู่กับรหัสนักศึกษาที่ช่องพิมพ์ของ kiosk
- โค้ดสร้าง/ตรวจอยู่ที่ `src/lib/tickets/gate-pass.ts` (Web Crypto — ใช้ร่วมกันทั้งมือถือและ server)
- ต้องเปิดผ่าน HTTPS หรือ `localhost` (Web Crypto ใช้ไม่ได้บน `http://<IP วง LAN>`)
- `/kiosk`: ต้องล็อกอิน staff · สแกนด้วยกล้อง + ช่องพิมพ์ รหัสนักศึกษา + รหัสสำรอง 6 หลัก
- Server ตรวจ: HMAC ถูก · timeStep อยู่ใน ±1 ช่วง · ตั๋ว active และเป็นของวันนี้ · อยู่ในเวลาทำการ
- ผล: 🟢 แอนิเมชันประตูเปิด หรือ 🔴 ปฏิเสธพร้อมเหตุผล (QR ไม่ถูกต้อง / หมดอายุ / ถูกยกเลิก / นอกเวลา)
- Kiosk ได้รับเฉพาะผลลัพธ์ ไม่ได้รับข้อมูลส่วนบุคคลเกินจำเป็น

## 6. Dashboard (staff)

- ยอดขาย/รายได้ รายวัน · สัปดาห์ · เดือน
- จำนวนคนเข้าใช้จริง + heatmap ชั่วโมง × วันในสัปดาห์
- รายชื่อผู้ซื้อ ค้นหาได้ ดูประวัติรายคน export CSV
- คิวสลิปมีปัญหา + สถิติการตรวจสลิป
- **ไม่ทำ:** จำนวนคนในฟิตเนสตอนนี้ (ข้อมูลคณะ/ชั้นปีเก็บแล้ว เพิ่มเป็นกราฟได้ภายหลัง)

## 7. Environment variables

| ตัวแปร | ใช้ที่ |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | client + server (publishable / anon key) |
| `SUPABASE_SECRET_KEY` | server เท่านั้น (เขียนออเดอร์/ผลสลิป, seed) — ห้ามใช้ในโค้ดฝั่ง client |
| `SUPER_ADMIN_EMAIL` | script seed |
| `SLIP_VERIFIER` | `slip2go` \| `mock` |
| `PROMPTPAY_ID` | บัญชีรับเงิน PromptPay (Slip2Go ตรวจว่าโอนเข้าบัญชีนี้) |
| `SLIP2GO_API_URL`, `SLIP2GO_SECRET_KEY` | ใช้เมื่อ `SLIP_VERIFIER=slip2go` (`https://connect.slip2go.com`) |

## 8. ลำดับการทำงาน

1. **Auth + profile** — Google Login, onboarding (consent → ลงทะเบียน), role, seed super admin
2. ซื้อและชำระเงิน — ออเดอร์, PromptPay QR, SlipVerifier (slip2go + mock)
3. ตั๋ว + QR (TOTP)
4. Gate Kiosk
5. คิว staff + จัดการ staff/settings
6. Dashboard
7. Demo deploy (mock) + E2E

**Definition of done ทุกขั้น:** `npm run lint` · `npm run typecheck` · `npm test` · `npm run build` ผ่านทั้งหมด

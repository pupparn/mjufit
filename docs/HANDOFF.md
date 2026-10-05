# Handoff — MJU FitPass (continue on MacBook)

Written 2026-10-04 at the end of a Windows session. Next session: **set up the repo on the MacBook, then build Step 4 (Gate Kiosk).**

## Source of truth (read these, don't re-derive)

- Repo: https://github.com/pupparn/mjufit — branch `master`, single commit "Add MJU FitPass: online gym Day Pass for Maejo students". The Next.js app lives in `mjufitpass/`.
- `mjufitpass/SPEC.md` — full agreed spec. The kiosk is section 5 and the work order is section 8.
- `mjufitpass/README.md` — setup guide (Supabase, Google OAuth, Slip2Go, env, scripts, dev clock, code map).
- `docs/flowchart.html` — Mermaid flowcharts of all flows; flow 5 is the kiosk.
- `mjufitpass/AGENTS.md` — **Next.js 16 has breaking changes. Read `node_modules/next/dist/docs/` before writing Next code** (e.g. `middleware.ts` is now `src/proxy.ts`, and `cookies()`/`params` are async).

## Status

| Step | State |
|---|---|
| 1 Auth + profile (Google login, PDPA consent, registration form, roles) | Done, used live |
| 2 Purchase + payment (orders, PromptPay QR, Slip2Go/mock, realtime) | Done. Supabase has 1 paid order + 1 ticket from a real test |
| 3 Ticket page `/ticket` with rotating TOTP QR + 6-digit backup code | Done, merged. **Not yet visually checked in a browser** |
| 4 Gate Kiosk (`/kiosk`, `gate_scans` log, manual code) | Done, scanning verified live. Migration `20261004060000_gate_scans.sql` must be pushed (`npx supabase db push`) |
| 5 Staff queue + staff/settings management | Done, migration pushed. RPCs tested in PGlite; pages not yet clicked through logged in |
| 6 Dashboard (stats, heatmap, buyers + CSV, slip stats) | Done in code; not yet viewed logged in |
| 7 Demo deploy (Vercel, mock) + Playwright E2E | Not started |

All 7 migrations in `mjufitpass/supabase/migrations/` are pushed to the remote Supabase project. Settings were changed live: `sales_cutoff` is now **19:00** (the spec default is 19:30).

## MacBook setup

1. Clone the repo, `cd mjufitpass`, `npm install`. Use Node 24 (Windows had 24.19); `@types/node` is pinned to ^24 because vitest 5 needs it.
2. Recreate `mjufitpass/.env.local`. It is gitignored, so it is **not in the repo**. Copy it securely from the Windows machine (`D:\frontendProject\mjufitpass\.env.local`) or rebuild it from `.env.example`. The keys it holds (values intentionally omitted):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (Supabase → Project Settings → API)
   - `SUPER_ADMIN_EMAIL` (the user's own Gmail; already seeded, no need to re-run `npm run seed`)
   - `PROMPTPAY_ID` (real 10-digit phone)
   - `SLIP_VERIFIER=slip2go`, `SLIP2GO_API_URL=https://connect.slip2go.com`, `SLIP2GO_SECRET_KEY`
3. Link the Supabase CLI. `supabase/.temp` is gitignored, so the link doesn't carry over: `npx supabase login`, then `npx supabase link --project-ref <ref>` (the ref is the subdomain of `NEXT_PUBLIC_SUPABASE_URL`).
4. Google OAuth redirect URLs already include `http://localhost:3000/auth/callback`, so `npm run dev` on port 3000 works unchanged.
5. Verify with `npm run lint && npm run typecheck && npm test && npm run build`. All passed at handoff with 118 tests.

## Step 4 — Gate Kiosk: what's already in place

- `src/lib/tickets/gate-pass.ts` has `parseGatePass`, `verifyGatePass` (±1 × 30 s step window, returns `invalid` or `expired`), and `verifyManualCode` for the backup path (student ID + 6 digits). It uses Web Crypto, so it runs on the server unchanged. Tests are in `tickets.test.ts`.
- `src/lib/tickets/validity.ts` has `ticketValidity` (cancelled / not_today / after_close). **Opening hours are deliberately not checked there.** The kiosk must also reject scans before `settings.open_time`, the first real use of `open_time`.
- `requireArea("staff")` in `src/lib/auth/viewer.ts` gates staff pages. The spec says the kiosk requires a staff login (option A).
- Use `appNow()` from `src/lib/clock.ts` for all time checks so the dev clock (🕒 panel, dev only) applies.

### Still to decide or build for step 4

- **Entry log table** (e.g. `gate_scans`: ticket_id nullable, result, reason, scanned_at, staff). The spec says to log every scan, and Step 6 needs it for visit counts and the hour × weekday heatmap. Read it with the admin client only.
- **Server action** that takes the raw QR text or (student ID + code) and returns only `{ok, reason, firstName?}`. Per the spec, don't send PII to the kiosk beyond what's needed. Look up the ticket's `totp_secret` with `createAdminClient()` (server-only). **Never select `totp_secret` anywhere a non-owner can see it.**
- **Camera QR scanning library.** Pick one and confirm it works with Next 16 / React 19 (candidates: `@zxing/browser`, `qr-scanner`, `html5-qrcode`). The camera also needs HTTPS or localhost.
- **UI:** full-screen tablet layout, door-open animation (green) or rejection (red + Thai reason), manual-entry fallback. Put Thai copy in `src/messages/th.ts`.
- Reject reasons to cover: QR invalid, QR expired (screenshot), ticket cancelled, not today, after close, before open.

## Decisions made in conversation that aren't obvious from the code

- Unreadable or non-slip images (Slip2Go 400001/400002) → re-upload on the same order, **not** the staff queue. This is in SPEC §4.
- Slip size max is 4 MB and only JPG/PNG are accepted: Vercel caps request bodies at 4.5 MB, and Slip2Go rejects WEBP. The `slips` bucket still lists webp, which is harmless.
- Slip2Go details were confirmed against the public docs: payload conditions go **directly in `payload`** for the image endpoint (not under `checkCondition`), and the PromptPay receiver is `accountType "02001"` with `accountNumber` as digits only.
- **The Slip2Go trial package expires 2026-10-11** (~100 slips of quota). After that every slip goes to the staff queue as `verifier_unavailable`. Switch to `SLIP_VERIFIER=mock` or renew.
- Faculty list in `src/lib/registration.ts` was hand-edited by the user (campuses removed). Don't overwrite it.
- `record_slip_result` takes `p_now` from the app so the dev clock and DB expiry agree.
- SQL was verified ad hoc with PGlite (`@electric-sql/pglite`) using a stubbed `auth` schema. Those scripts lived in a Windows temp dir and are **not** in the repo. Recreate a harness if you need to test new migrations (no Docker was available, so there's no `supabase start`).

## Gotchas

- Dev only: `DEV_IGNORE_HOURS=1` in `.env.local` ignores open/close/sales-cutoff on every device (restart dev server). The 🕒 dev clock is a per-browser cookie, so a mismatch between devices makes QR/backup codes fail as expired.

- The `cn` import in `src/components/ui/*` is shadcn's own `cn` package (github.com/shadcn-ui/cn), not a typo.
- Base UI `Button` must not render links. Style `<Link>` with `buttonVariants(...)` instead.
- The ESLint `react-hooks/purity` rule flags `Date.now()` during render in server components. Use `await appNow()`.
- Web Crypto (QR generation) fails on `http://<LAN IP>`. Test phones via HTTPS (Vercel or a tunnel).
- `database.types.ts` is hand-written. Update it when you add tables or RPCs (or run `npx supabase gen types typescript --linked`).
- The user communicates mostly in Thai. Reply in Thai unless they write in English.

## Suggested skills

- `mattpocock-skills:grilling` — settle the open Step 4 questions above (scan log schema, scanner library, what the kiosk displays) with the user before building.
- `mattpocock-skills:tdd` — the kiosk verification action (pass/manual code → validity → open-hours → log) is pure-ish logic worth writing test-first.
- `run` — launch the dev server and check `/ticket` and `/kiosk` in the browser (step 3 UI hasn't been seen yet).
- `mattpocock-skills:code-review` — review the step 4 diff against SPEC before committing.

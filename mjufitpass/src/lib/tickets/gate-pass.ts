// Rotating gate pass (TOTP-style). The phone signs the current 30-second
// time step with the ticket's secret; the kiosk server re-computes and checks
// it. Pure Web Crypto, so the same code runs in the browser (offline) and on
// the server.
//
// Payload: MJUFP1.<ticketId>.<step>.<mac>
//   step = floor(unixMs / 30 000)
//   mac  = base64url(HMAC-SHA256(secret, "<ticketId>.<step>")[0..16])

export const PASS_PREFIX = "MJUFP1";
export const STEP_MS = 30_000;
/** Accept codes up to one step old or ahead (phone/kiosk clock drift, slow scans). */
export const STEP_WINDOW = 1;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function timeStep(nowMs: number): number {
  return Math.floor(nowMs / STEP_MS);
}

/** Milliseconds until the code shown at `nowMs` rotates. */
export function msUntilNextStep(nowMs: number): number {
  return STEP_MS - (nowMs % STEP_MS);
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

async function sign(secret: string, ticketId: string, step: number): Promise<string> {
  return base64url((await hmac(secret, `${ticketId}.${step}`)).slice(0, 16));
}

export async function createGatePass(secret: string, ticketId: string, nowMs: number): Promise<string> {
  const step = timeStep(nowMs);
  return `${PASS_PREFIX}.${ticketId}.${step}.${await sign(secret, ticketId, step)}`;
}

export type ParsedPass = { ticketId: string; step: number; mac: string };

/** Structural parse only — no secret needed. Lets the server look up the ticket. */
export function parseGatePass(payload: string): ParsedPass | null {
  const parts = payload.trim().split(".");
  if (parts.length !== 4 || parts[0] !== PASS_PREFIX) return null;
  const [, ticketId, stepText, mac] = parts;
  if (!UUID.test(ticketId) || !/^\d+$/.test(stepText) || !/^[A-Za-z0-9_-]{22}$/.test(mac)) return null;
  return { ticketId: ticketId.toLowerCase(), step: Number(stepText), mac };
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type PassCheck = { ok: true } | { ok: false; reason: "invalid" | "expired" };

/** Checks a parsed pass against the ticket's secret at `nowMs`. */
export async function verifyGatePass(pass: ParsedPass, secret: string, nowMs: number): Promise<PassCheck> {
  if (!safeEqual(pass.mac, await sign(secret, pass.ticketId, pass.step))) return { ok: false, reason: "invalid" };
  // Genuine code, but from a screenshot or a phone with a badly wrong clock.
  if (Math.abs(pass.step - timeStep(nowMs)) > STEP_WINDOW) return { ok: false, reason: "expired" };
  return { ok: true };
}

// Backup code for the kiosk's manual entry: student ID + 6 rotating digits,
// derived from the same secret under a separate message so it can't be
// confused with the QR MAC.

export async function createManualCode(secret: string, ticketId: string, nowMs: number): Promise<string> {
  return manualCodeAt(secret, ticketId, timeStep(nowMs));
}

async function manualCodeAt(secret: string, ticketId: string, step: number): Promise<string> {
  const bytes = await hmac(secret, `${ticketId}.${step}.manual`);
  const n = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return String(n % 1_000_000).padStart(6, "0");
}

/** Checks a 6-digit code within the same ±1 step window as the QR. */
export async function verifyManualCode(code: string, secret: string, ticketId: string, nowMs: number): Promise<boolean> {
  const digits = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(digits)) return false;
  const now = timeStep(nowMs);
  for (let step = now - STEP_WINDOW; step <= now + STEP_WINDOW; step++) {
    if (safeEqual(digits, await manualCodeAt(secret, ticketId, step))) return true;
  }
  return false;
}

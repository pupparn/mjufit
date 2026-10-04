import { describe, expect, it } from "vitest";
import {
  createGatePass,
  createManualCode,
  msUntilNextStep,
  parseGatePass,
  STEP_MS,
  timeStep,
  verifyGatePass,
  verifyManualCode,
} from "./gate-pass";
import { ticketValidity } from "./validity";

const ticketId = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";
const secret = "a".repeat(64);
const t0 = Date.parse("2026-10-05T03:00:10Z");

async function check(payload: string, nowMs: number, key = secret) {
  const pass = parseGatePass(payload);
  if (!pass) return { ok: false, reason: "malformed" };
  return verifyGatePass(pass, key, nowMs);
}

describe("gate pass", () => {
  it("round-trips at the same moment", async () => {
    const payload = await createGatePass(secret, ticketId, t0);
    expect(payload).toMatch(/^MJUFP1\.[0-9a-f-]{36}\.\d+\.[A-Za-z0-9_-]{22}$/);
    expect(await check(payload, t0)).toEqual({ ok: true });
  });

  it("is stable within a step and changes on the next one", async () => {
    const start = timeStep(t0) * STEP_MS;
    const a = await createGatePass(secret, ticketId, start);
    const b = await createGatePass(secret, ticketId, start + STEP_MS - 1);
    const c = await createGatePass(secret, ticketId, start + STEP_MS);
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });

  it("accepts one step of drift either way", async () => {
    const payload = await createGatePass(secret, ticketId, t0);
    expect(await check(payload, t0 + STEP_MS)).toEqual({ ok: true });
    expect(await check(payload, t0 - STEP_MS)).toEqual({ ok: true });
  });

  it("rejects a genuine code two steps old as expired (screenshot)", async () => {
    const payload = await createGatePass(secret, ticketId, t0);
    expect(await check(payload, t0 + 2 * STEP_MS)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a code signed with another ticket's secret", async () => {
    const payload = await createGatePass("b".repeat(64), ticketId, t0);
    expect(await check(payload, t0)).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a tampered step or ticket id", async () => {
    const [prefix, id, step, mac] = (await createGatePass(secret, ticketId, t0)).split(".");
    expect(await check([prefix, id, String(Number(step) + 1), mac].join("."), t0)).toEqual({
      ok: false,
      reason: "invalid",
    });
    const otherId = "00000000-0000-4000-8000-000000000000";
    expect(await check([prefix, otherId, step, mac].join("."), t0)).toEqual({ ok: false, reason: "invalid" });
  });

  it.each([
    "",
    "hello",
    "MJUFP1.not-a-uuid.1.AAAAAAAAAAAAAAAAAAAAAA",
    `MJUFP2.${ticketId}.1.AAAAAAAAAAAAAAAAAAAAAA`,
    `MJUFP1.${ticketId}.-1.AAAAAAAAAAAAAAAAAAAAAA`,
    `MJUFP1.${ticketId}.1.short`,
    `MJUFP1.${ticketId}.1.AAAAAAAAAAAAAAAAAAAAAA.extra`,
  ])("does not parse %j", (payload) => {
    expect(parseGatePass(payload)).toBeNull();
  });

  it("tolerates surrounding whitespace from manual entry", async () => {
    const payload = await createGatePass(secret, ticketId, t0);
    expect(parseGatePass(`  ${payload}\n`)).not.toBeNull();
  });

  it("reports time to the next rotation", () => {
    const start = timeStep(t0) * STEP_MS;
    expect(msUntilNextStep(start)).toBe(STEP_MS);
    expect(msUntilNextStep(start + 29_000)).toBe(1_000);
  });
});

describe("manual backup code", () => {
  it("is 6 digits and verifies within the window", async () => {
    const code = await createManualCode(secret, ticketId, t0);
    expect(code).toMatch(/^\d{6}$/);
    expect(await verifyManualCode(code, secret, ticketId, t0)).toBe(true);
    expect(await verifyManualCode(`${code.slice(0, 3)} ${code.slice(3)}`, secret, ticketId, t0 + STEP_MS)).toBe(true);
  });

  it("rejects old codes, other tickets and junk", async () => {
    const code = await createManualCode(secret, ticketId, t0);
    expect(await verifyManualCode(code, secret, ticketId, t0 + 2 * STEP_MS)).toBe(false);
    expect(await verifyManualCode(code, "b".repeat(64), ticketId, t0)).toBe(false);
    expect(await verifyManualCode("12345", secret, ticketId, t0)).toBe(false);
    expect(await verifyManualCode("abcdef", secret, ticketId, t0)).toBe(false);
  });

  it("differs from the QR MAC derivation", async () => {
    const [, , , mac] = (await createGatePass(secret, ticketId, t0)).split(".");
    expect(mac).not.toContain(await createManualCode(secret, ticketId, t0));
  });
});

describe("ticketValidity", () => {
  const settings = { closeTime: "20:00:00" };
  const active = { status: "active" as const, businessDate: "2026-10-05" };
  const bkk = (iso: string) => new Date(`${iso}+07:00`);

  it("is valid during the day, even before opening", () => {
    expect(ticketValidity(active, bkk("2026-10-05T06:00:00"), settings)).toBe("valid");
    expect(ticketValidity(active, bkk("2026-10-05T19:59:00"), settings)).toBe("valid");
  });

  it("expires at closing time", () => {
    expect(ticketValidity(active, bkk("2026-10-05T20:00:00"), settings)).toBe("after_close");
  });

  it("is not valid on another day", () => {
    expect(ticketValidity(active, bkk("2026-10-06T09:00:00"), settings)).toBe("not_today");
  });

  it("reports cancellation first", () => {
    expect(ticketValidity({ ...active, status: "cancelled" }, bkk("2026-10-05T09:00:00"), settings)).toBe(
      "cancelled",
    );
  });
});

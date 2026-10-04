import "server-only";
import { cookies } from "next/headers";

// Dev-only clock override so time-based rules (sales cutoff, closed days,
// order expiry) can be tested without waiting. Stored as an offset from the
// real clock, so simulated time keeps ticking. Never active in production.
export const DEV_CLOCK_COOKIE = "dev-clock-offset-ms";

export function devClockEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

export async function clockOffsetMs(): Promise<number> {
  if (!devClockEnabled()) return 0;
  const offset = Number((await cookies()).get(DEV_CLOCK_COOKIE)?.value);
  return Number.isFinite(offset) ? offset : 0;
}

/** The app's notion of "now". Use this instead of `new Date()` in business logic. */
export async function appNow(): Promise<Date> {
  return new Date(Date.now() + (await clockOffsetMs()));
}

/**
 * Dev-only: set DEV_IGNORE_HOURS=1 in .env.local (then restart `npm run dev`)
 * to treat opening hours, sales cutoff and closing time as always open — on
 * every device, since it lives on the server. Never active in production.
 */
export function devIgnoreHours(): boolean {
  return devClockEnabled() && process.env.DEV_IGNORE_HOURS === "1";
}

/** All-day hours for dev mode; "23:59" is the latest time the "HH:MM" comparisons can reach. */
export const ALL_DAY = { openTime: "00:00", closeTime: "23:59", salesCutoff: "23:59" } as const;

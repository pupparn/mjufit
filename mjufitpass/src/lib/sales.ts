import { bangkokDate, bangkokTime, hhmm } from "./time";

export type Settings = {
  priceSatang: number;
  openTime: string; // "HH:MM" or "HH:MM:SS"
  closeTime: string;
  salesCutoff: string;
  orderTtlMinutes: number;
};

export type SalesStatus =
  | { open: true; businessDate: string }
  | { open: false; businessDate: string; reason: "closed_day" | "after_cutoff" };

/**
 * Whether a Day Pass for today can be bought right now. Sales run from
 * midnight until the cutoff (buying before the gym opens is fine).
 */
export function salesStatus(now: Date, settings: Settings, closedDates: readonly string[]): SalesStatus {
  const businessDate = bangkokDate(now);
  if (closedDates.includes(businessDate)) return { open: false, businessDate, reason: "closed_day" };
  if (bangkokTime(now) >= hhmm(settings.salesCutoff)) {
    return { open: false, businessDate, reason: "after_cutoff" };
  }
  return { open: true, businessDate };
}

export function orderExpiresAt(now: Date, settings: Settings): Date {
  return new Date(now.getTime() + settings.orderTtlMinutes * 60_000);
}

/** 2000 → "20.00" */
export function formatBaht(satang: number): string {
  return (satang / 100).toFixed(2);
}

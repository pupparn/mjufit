import { bangkokDate } from "./time";

/** Bangkok date string + n days, e.g. addDays("2026-10-05", -1) → "2026-10-04". */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `date`. */
export function weekStart(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}

export type PaidOrder = { businessDate: string; amountSatang: number };
export type Totals = { count: number; satang: number };

function sum(orders: PaidOrder[]): Totals {
  return { count: orders.length, satang: orders.reduce((s, o) => s + o.amountSatang, 0) };
}

/** Sales for today, this week (Mon–Sun) and this month, by business date. */
export function salesTotals(orders: PaidOrder[], today: string) {
  const week = weekStart(today);
  const month = today.slice(0, 7);
  return {
    today: sum(orders.filter((o) => o.businessDate === today)),
    week: sum(orders.filter((o) => o.businessDate >= week && o.businessDate <= today)),
    month: sum(orders.filter((o) => o.businessDate.startsWith(month) && o.businessDate <= today)),
  };
}

/** One entry per day for the last `days` days ending today (oldest first). */
export function dailySales(orders: PaidOrder[], today: string, days: number) {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days + 1);
    return { date, ...sum(orders.filter((o) => o.businessDate === date)) };
  });
}

const hourFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hourCycle: "h23" });

/** grid[weekday][hour] of scan counts; weekday 0 = Monday. Bangkok time. */
export function entryHeatmap(scanTimes: Date[]): number[][] {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const t of scanTimes) {
    const weekday = (new Date(`${bangkokDate(t)}T00:00:00Z`).getUTCDay() + 6) % 7;
    grid[weekday][Number(hourFormat.format(t))]++;
  }
  return grid;
}

/** Slip check outcomes: verified count and a tally of failure reasons. */
export function slipStats(subs: { verified: boolean; reason: string | null }[]) {
  const reasons: Record<string, number> = {};
  for (const s of subs) if (s.reason) reasons[s.reason] = (reasons[s.reason] ?? 0) + 1;
  const verified = subs.filter((s) => s.verified).length;
  return { total: subs.length, verified, failed: subs.length - verified, reasons };
}

/** Counts of each value, most common first; null/empty counted under `unknown`. */
export function tally(values: (string | number | null)[], unknown: string): [string, number][] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = v === null || v === "" ? unknown : String(v);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** RFC 4180 CSV. Cells starting with = + - @ are prefixed so spreadsheets don't run them as formulas. */
export function toCsv(rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    let s = v === null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s) && typeof v === "string") s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

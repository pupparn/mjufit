// The gym runs on Bangkok time; servers run in UTC. Every "today" / "now" in
// business logic goes through these helpers with an injected `now`.
export const TIME_ZONE = "Asia/Bangkok";

const dateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Bangkok calendar date, e.g. "2026-10-04". */
export function bangkokDate(now: Date): string {
  return dateFormat.format(now);
}

/** Bangkok wall-clock time, e.g. "19:30". */
export function bangkokTime(now: Date): string {
  return timeFormat.format(now);
}

/** "08:00" or Postgres "08:00:00" → "08:00". */
export function hhmm(time: string): string {
  return time.slice(0, 5);
}

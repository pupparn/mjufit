import { YEARS_OF_STUDY } from "./registration";

export const BUYER_STATUSES = ["all", "paid", "needs_review", "rejected", "refund_due"] as const;
export type BuyerStatus = (typeof BUYER_STATUSES)[number];
export type BuyerFilter = { q: string; status: BuyerStatus; faculty: string; year: string; from: string; to: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Reads a filter from untrusted search params; anything invalid falls back to "no filter". */
export function parseBuyerFilter(sp: Record<string, string | string[] | undefined>): BuyerFilter {
  const get = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : (v ?? "")).trim();
  };
  const status = get("status");
  const year = get("year");
  return {
    q: get("q").slice(0, 50),
    status: (BUYER_STATUSES as readonly string[]).includes(status) ? (status as BuyerStatus) : "all",
    faculty: get("faculty").slice(0, 100), // not checked against FACULTIES: the DB doesn't constrain it either
    year: YEARS_OF_STUDY.map(String).includes(year) ? year : "",
    from: DATE.test(get("from")) ? get("from") : "",
    to: DATE.test(get("to")) ? get("to") : "",
  };
}

/** Query string for a filter, dropping empty fields and the default status. */
export function buyerQuery(f: Partial<BuyerFilter>): string {
  const entries = Object.entries(f).filter(([k, v]) => v && !(k === "status" && v === "all"));
  return new URLSearchParams(entries as [string, string][]).toString();
}

/** A `back` link is only followed if it stays inside the dashboard (no open redirect). */
export function safeBack(back: string | string[] | undefined, fallback: string): string {
  return typeof back === "string" && back.startsWith("/dashboard/") ? back : fallback;
}

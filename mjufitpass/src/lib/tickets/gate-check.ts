import type { Settings } from "@/lib/sales";
import type { TicketStatus } from "@/lib/supabase/database.types";
import { bangkokTime, hhmm } from "@/lib/time";
import { ticketValidity } from "./validity";

export type GateReason = "invalid" | "expired" | "no_ticket" | "cancelled" | "not_today" | "before_open" | "after_close";

export type GateDecision = { ok: true } | { ok: false; reason: GateReason };

/** Ticket-state rules at the gate: ticketValidity plus the opening-hours check it leaves out. */
export function gateDecision(
  ticket: { status: TicketStatus; businessDate: string },
  now: Date,
  settings: Pick<Settings, "openTime" | "closeTime">,
): GateDecision {
  const validity = ticketValidity(ticket, now, settings);
  if (validity !== "valid") return { ok: false, reason: validity };
  if (bangkokTime(now) < hhmm(settings.openTime)) return { ok: false, reason: "before_open" };
  return { ok: true };
}

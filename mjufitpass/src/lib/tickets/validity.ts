import type { Settings } from "@/lib/sales";
import type { TicketStatus } from "@/lib/supabase/database.types";
import { bangkokDate, bangkokTime, hhmm } from "@/lib/time";

export type TicketValidity = "valid" | "cancelled" | "not_today" | "after_close";

/**
 * Whether a Day Pass is usable at `now`: active, for today (Bangkok), and
 * before closing time. Opening hours are enforced at the gate (step 4), not
 * here, so the pass can be shown before the gym opens.
 */
export function ticketValidity(
  ticket: { status: TicketStatus; businessDate: string },
  now: Date,
  settings: Pick<Settings, "closeTime">,
): TicketValidity {
  if (ticket.status === "cancelled") return "cancelled";
  if (ticket.businessDate !== bangkokDate(now)) return "not_today";
  if (bangkokTime(now) >= hhmm(settings.closeTime)) return "after_close";
  return "valid";
}

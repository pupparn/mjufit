"use server";

import { requireArea } from "@/lib/auth/viewer";
import { ALL_DAY, appNow, devIgnoreHours } from "@/lib/clock";
import { createAdminClient } from "@/lib/supabase/admin";
import { gateDecision, type GateReason } from "@/lib/tickets/gate-check";
import { parseGatePass, verifyGatePass, verifyManualCode } from "@/lib/tickets/gate-pass";
import { bangkokDate } from "@/lib/time";
import { studentIdSchema } from "@/lib/student-id";

/** All the kiosk ever learns: pass/fail, why, and a first name to greet. */
export type ScanResult = { ok: true; firstName: string | null } | { ok: false; reason: GateReason | "error" };

export type ScanInput = { method: "qr"; payload: string } | { method: "manual"; studentId: string; code: string };

export async function scanAction(input: ScanInput): Promise<ScanResult> {
  const viewer = await requireArea("staff");
  if (viewer.kind !== "staff") return { ok: false, reason: "error" };

  const db = createAdminClient();
  const now = await appNow();
  const today = bangkokDate(now);

  const ticketCols = "id, user_id, status, business_date, totp_secret";
  let ticket: {
    id: string;
    user_id: string;
    status: "active" | "cancelled";
    business_date: string;
    totp_secret: string;
  } | null = null;
  let reason: GateReason | null = null;

  if (input.method === "qr") {
    const pass = parseGatePass(String(input.payload));
    if (!pass) {
      reason = "invalid";
    } else {
      const { data, error } = await db.from("tickets").select(ticketCols).eq("id", pass.ticketId).maybeSingle();
      if (error) return { ok: false, reason: "error" };
      ticket = data;
      if (!ticket) {
        reason = "invalid";
      } else {
        const check = await verifyGatePass(pass, ticket.totp_secret, now.getTime());
        if (!check.ok) reason = check.reason;
      }
    }
  } else {
    const parsed = studentIdSchema.safeParse(input.studentId);
    if (!parsed.success) {
      reason = "invalid";
    } else {
      const { data: profile, error } = await db.from("profiles").select("id").eq("student_id", parsed.data).maybeSingle();
      if (error) return { ok: false, reason: "error" };
      if (!profile) {
        reason = "invalid";
      } else {
        const { data, error: ticketError } = await db
          .from("tickets")
          .select(ticketCols)
          .eq("user_id", profile.id)
          .eq("business_date", today)
          .maybeSingle();
        if (ticketError) return { ok: false, reason: "error" };
        ticket = data;
        if (!ticket) reason = "no_ticket";
        else if (!(await verifyManualCode(String(input.code), ticket.totp_secret, ticket.id, now.getTime()))) {
          reason = "invalid";
        }
      }
    }
  }

  // Only a genuine pass (or code) reaches the state rules.
  if (!reason && ticket) {
    const { data: settings, error } = await db.from("settings").select("open_time, close_time").eq("id", 1).single();
    if (error) return { ok: false, reason: "error" };
    const decision = gateDecision(
      { status: ticket.status, businessDate: ticket.business_date },
      now,
      devIgnoreHours() ? ALL_DAY : { openTime: settings.open_time, closeTime: settings.close_time },
    );
    if (!decision.ok) reason = decision.reason;
  }

  const { error: logError } = await db.from("gate_scans").insert({
    ticket_id: ticket?.id ?? null,
    ok: reason === null,
    reason,
    method: input.method,
    staff_email: viewer.email,
    scanned_at: now.toISOString(),
  });
  // Every scan must be logged; fail closed rather than let someone in unrecorded.
  if (logError) return { ok: false, reason: "error" };

  if (reason) return { ok: false, reason };

  const { data: profile } = await db.from("profiles").select("first_name").eq("id", ticket!.user_id).maybeSingle();
  return { ok: true, firstName: profile?.first_name ?? null };
}

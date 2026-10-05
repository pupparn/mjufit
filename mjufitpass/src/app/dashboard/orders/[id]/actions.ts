"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/viewer";
import { appNow } from "@/lib/clock";
import { createAdminClient } from "@/lib/supabase/admin";
import { ticketValidity } from "@/lib/tickets/validity";
import { th } from "@/messages/th";

export type OrderActionState = { error: string | null };

const KNOWN_ERRORS = ["note_required", "order_not_reviewable", "ticket_not_active", "no_refund_due"] as const;

/** One form, four buttons: the clicked button's `intent` picks the RPC. */
export async function orderAction(orderId: string, _prev: OrderActionState, formData: FormData): Promise<OrderActionState> {
  const viewer = await requireArea("staff");
  if (viewer.kind !== "staff") return { error: th.staff.order.errors.unknown };

  const intent = String(formData.get("intent"));
  const note = String(formData.get("note") ?? "").trim();
  const refund = formData.get("refund") === "on";
  const db = createAdminClient();

  let result: { error: { message: string } | null };
  if (intent === "approve") {
    // Approving a pass that can't be used (closed, or another day) means the student paid for nothing.
    const [{ data: order }, { data: settings }] = await Promise.all([
      db.from("orders").select("business_date").eq("id", orderId).maybeSingle(),
      db.from("settings").select("close_time").eq("id", 1).single(),
    ]);
    if (!order || !settings) return { error: th.staff.order.errors.unknown };
    const usable =
      ticketValidity({ status: "active", businessDate: order.business_date }, await appNow(), {
        closeTime: settings.close_time,
      }) === "valid";
    result = await db.rpc("staff_review_order", {
      p_order_id: orderId,
      p_approve: true,
      p_refund: !usable,
      p_note: note,
      p_staff_email: viewer.email,
    });
  } else if (intent === "reject") {
    result = await db.rpc("staff_review_order", {
      p_order_id: orderId,
      p_approve: false,
      p_refund: refund,
      p_note: note,
      p_staff_email: viewer.email,
    });
  } else if (intent === "cancel") {
    result = await db.rpc("staff_cancel_ticket", {
      p_order_id: orderId,
      p_refund: refund,
      p_note: note,
      p_staff_email: viewer.email,
    });
  } else if (intent === "refunded") {
    result = await db.rpc("staff_mark_refunded", { p_order_id: orderId, p_note: note, p_staff_email: viewer.email });
  } else {
    return { error: th.staff.order.errors.unknown };
  }

  if (result.error) {
    const known = KNOWN_ERRORS.find((code) => result.error!.message.includes(code));
    return { error: th.staff.order.errors[known ?? "unknown"] };
  }

  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/queue");
  return { error: null };
}

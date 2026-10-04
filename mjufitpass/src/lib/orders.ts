import "server-only";
import { assessSlip } from "@/lib/payments/assess";
import type { SlipVerifier } from "@/lib/payments/slip-verifier";
import { orderExpiresAt, salesStatus, type SalesStatus, type Settings } from "@/lib/sales";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderStatus } from "@/lib/supabase/database.types";
import { bangkokDate } from "@/lib/time";

type Admin = ReturnType<typeof createAdminClient>;

const LIVE_STATUSES: OrderStatus[] = ["pending_payment", "paid", "needs_review"];

export type Order = {
  id: string;
  userId: string;
  businessDate: string;
  amountSatang: number;
  status: OrderStatus;
  reviewReason: string | null;
  expiresAt: Date;
};

function toOrder(row: {
  id: string;
  user_id: string;
  business_date: string;
  amount_satang: number;
  status: OrderStatus;
  review_reason: string | null;
  expires_at: string;
}): Order {
  return {
    id: row.id,
    userId: row.user_id,
    businessDate: row.business_date,
    amountSatang: row.amount_satang,
    status: row.status,
    reviewReason: row.review_reason,
    expiresAt: new Date(row.expires_at),
  };
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what}: ${error.message}`);
}

export async function loadSalesContext(admin: Admin = createAdminClient()) {
  const [settingsResult, closedResult] = await Promise.all([
    admin.from("settings").select("*").eq("id", 1).single(),
    admin.from("closed_dates").select("date"),
  ]);
  if (settingsResult.error) fail("load settings", settingsResult.error);
  if (closedResult.error) fail("load closed dates", closedResult.error);

  const row = settingsResult.data;
  const settings: Settings = {
    priceSatang: row.price_satang,
    openTime: row.open_time,
    closeTime: row.close_time,
    salesCutoff: row.sales_cutoff,
    orderTtlMinutes: row.order_ttl_minutes,
  };
  return { settings, closedDates: closedResult.data.map((d) => d.date) };
}

/** Marks this user's stale pending orders as expired so they stop blocking. */
async function expireStaleOrders(admin: Admin, userId: string, now: Date) {
  const { error } = await admin
    .from("orders")
    .update({ status: "expired", updated_at: now.toISOString() })
    .eq("user_id", userId)
    .eq("status", "pending_payment")
    .lt("expires_at", now.toISOString());
  if (error) fail("expire stale orders", error);
}

async function findLiveOrder(admin: Admin, userId: string, businessDate: string) {
  const { data, error } = await admin
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .eq("business_date", businessDate)
    .in("status", LIVE_STATUSES)
    .maybeSingle();
  if (error) fail("find live order", error);
  return data ? toOrder(data) : null;
}

export type TodayState = {
  sales: SalesStatus;
  priceSatang: number;
  order: Order | null; // today's live order, if any
};

export async function getTodayState(userId: string, now: Date): Promise<TodayState> {
  const admin = createAdminClient();
  await expireStaleOrders(admin, userId, now);
  const [{ settings, closedDates }, order] = await Promise.all([
    loadSalesContext(admin),
    findLiveOrder(admin, userId, bangkokDate(now)),
  ]);
  return { sales: salesStatus(now, settings, closedDates), priceSatang: settings.priceSatang, order };
}

export type CreateOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; reason: "closed_day" | "after_cutoff" };

/** Creates today's order, or returns the live one if it already exists. */
export async function createOrder(userId: string, now: Date): Promise<CreateOrderResult> {
  const admin = createAdminClient();
  await expireStaleOrders(admin, userId, now);

  const { settings, closedDates } = await loadSalesContext(admin);
  const sales = salesStatus(now, settings, closedDates);

  const existing = await findLiveOrder(admin, userId, sales.businessDate);
  if (existing) return { ok: true, orderId: existing.id };
  if (!sales.open) return { ok: false, reason: sales.reason };

  const { data, error } = await admin
    .from("orders")
    .insert({
      user_id: userId,
      business_date: sales.businessDate,
      amount_satang: settings.priceSatang,
      expires_at: orderExpiresAt(now, settings).toISOString(),
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    // Lost a race with another tab; use the order that won.
    const winner = await findLiveOrder(admin, userId, sales.businessDate);
    if (winner) return { ok: true, orderId: winner.id };
  }
  if (error) fail("create order", error);
  return { ok: true, orderId: data.id };
}

/** Loads an order only if it belongs to `userId`. */
export async function getOwnOrder(userId: string, orderId: string): Promise<Order | null> {
  const { data, error } = await createAdminClient()
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail("load order", error);
  return data ? toOrder(data) : null;
}

export type SubmitSlipResult =
  | { ok: true; status: OrderStatus }
  | { ok: false; error: "order_not_pending" | "order_expired" | "reupload"; detail?: string };

export async function submitSlip(params: {
  order: Order;
  file: File;
  ext: string;
  verifier: SlipVerifier;
  now: Date;
}): Promise<SubmitSlipResult> {
  const { order, file, ext, verifier, now } = params;
  if (order.status !== "pending_payment") return { ok: false, error: "order_not_pending" };
  if (order.expiresAt < now) return { ok: false, error: "order_expired" };

  // Store first: Slip2Go marks a slip as used once it passes (checkDuplicate), so a storage
  // failure after verifying would turn every retry into a "duplicate".
  // A re-upload after an unreadable image simply overwrites this path.
  const admin = createAdminClient();
  const storagePath = `${order.userId}/${order.id}.${ext}`;
  const upload = await admin.storage
    .from("slips")
    .upload(storagePath, file, { contentType: file.type, upsert: true });
  if (upload.error) fail("upload slip", upload.error);

  const check = await verifier.verify({
    file,
    filename: `slip.${ext}`,
    expectedAmountSatang: order.amountSatang,
  });
  const assessment = assessSlip(check, order);
  if (assessment.action === "reupload") return { ok: false, error: "reupload", detail: assessment.reason };

  const { data: status, error } = await admin.rpc("record_slip_result", {
    p_order_id: order.id,
    p_storage_path: storagePath,
    p_verifier: verifier.name,
    p_verified: assessment.verified,
    p_reason: assessment.reason,
    p_trans_ref: assessment.transRef,
    p_amount_satang: assessment.amountSatang,
    p_transferred_at: assessment.transferredAt?.toISOString() ?? null,
    p_raw: JSON.parse(JSON.stringify(check.raw ?? null)),
    p_now: now.toISOString(),
  });
  if (error?.message.includes("order_not_pending")) return { ok: false, error: "order_not_pending" };
  if (error) fail("record slip result", error);
  if (status === "expired") return { ok: false, error: "order_expired" };
  return { ok: true, status };
}

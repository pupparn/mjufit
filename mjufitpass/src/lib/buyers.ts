import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type BuyerRow = {
  id: string;
  business_date: string;
  amount_satang: number;
  status: string;
  refund_required: boolean;
  refunded_at: string | null;
  profiles: {
    student_id: string | null;
    first_name: string | null;
    last_name: string | null;
    faculty: string | null;
    year_of_study: number | null;
  } | null;
};

/** Newest orders (any status but pending/expired), optionally filtered by student ID prefix or name. */
export async function loadBuyers(q: string, limit: number): Promise<BuyerRow[]> {
  const db = createAdminClient();
  let userIds: string[] | null = null;
  if (q) {
    const term = q.replace(/[%,()*\\]/g, " ").trim(); // keep PostgREST filter syntax out of the term
    const { data, error } = await db
      .from("profiles")
      .select("id")
      .or(`student_id.like.${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`);
    if (error) throw new Error(`buyers search: ${error.message}`);
    userIds = data.map((p) => p.id);
    if (userIds.length === 0) return [];
  }

  let query = db
    .from("orders")
    .select(
      "id, business_date, amount_satang, status, refund_required, refunded_at, profiles(student_id, first_name, last_name, faculty, year_of_study)",
    )
    .in("status", ["paid", "needs_review", "rejected"])
    .order("business_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (userIds) query = query.in("user_id", userIds);
  const { data, error } = await query.returns<BuyerRow[]>();
  if (error) throw new Error(`buyers: ${error.message}`);
  return data;
}

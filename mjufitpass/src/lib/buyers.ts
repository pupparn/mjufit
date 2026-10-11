import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { type BuyerFilter } from "./buyer-filter";

export type BuyerRow = {
  id: string;
  business_date: string;
  amount_satang: number;
  status: string;
  review_reason: string | null;
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

/** Orders matching the staff filter. Lists skip pending/expired; a search under "all" finds every status (stuck orders). */
export async function loadBuyers(f: BuyerFilter, limit: number): Promise<BuyerRow[]> {
  const byProfile = Boolean(f.q || f.faculty || f.year);
  // !inner turns profile filters into filters on the orders themselves.
  let query = createAdminClient()
    .from("orders")
    .select(
      `id, business_date, amount_satang, status, review_reason, refund_required, refunded_at, profiles${byProfile ? "!inner" : ""}(student_id, first_name, last_name, faculty, year_of_study)`,
    );

  if (f.status === "refund_due" || (f.status === "all" && !f.q)) query = query.in("status", ["paid", "needs_review", "rejected"]);
  else if (f.status !== "all") query = query.eq("status", f.status);
  if (f.status === "paid" || f.status === "refund_due") query = query.is("refunded_at", null);
  if (f.status === "refund_due") query = query.eq("refund_required", true);

  if (f.from) query = query.gte("business_date", f.from);
  if (f.to) query = query.lte("business_date", f.to);
  if (f.faculty) query = query.eq("profiles.faculty", f.faculty);
  if (f.year) query = query.eq("profiles.year_of_study", Number(f.year));
  if (f.q) {
    const term = f.q.replace(/[%,()*\\]/g, " ").trim(); // keep PostgREST filter syntax out of the term
    query = query.or(`student_id.like.${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`, { referencedTable: "profiles" });
  }

  // Work queues are first-in first-served; everything else newest first.
  query =
    f.status === "needs_review" || f.status === "refund_due"
      ? query.order("created_at")
      : query.order("business_date", { ascending: false }).order("created_at", { ascending: false });

  const { data, error } = await query.limit(limit).returns<BuyerRow[]>();
  if (error) throw new Error(`buyers: ${error.message}`);
  return data;
}

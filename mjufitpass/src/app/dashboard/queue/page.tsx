import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireArea } from "@/lib/auth/viewer";
import { formatBaht } from "@/lib/sales";
import { createAdminClient } from "@/lib/supabase/admin";
import { STUDENT_ID_PATTERN } from "@/lib/student-id";
import { th } from "@/messages/th";

type Row = {
  id: string;
  business_date: string;
  amount_satang: number;
  status: string;
  review_reason: string | null;
  profiles: { student_id: string | null; first_name: string | null; last_name: string | null } | null;
};

const COLS = "id, business_date, amount_satang, status, review_reason, profiles(student_id, first_name, last_name)";

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireArea("staff");
  const q = ((await searchParams).q ?? "").trim();
  const db = createAdminClient();

  const searched = STUDENT_ID_PATTERN.test(q)
    ? await db.from("profiles").select("id").eq("student_id", q).maybeSingle()
    : null;
  if (searched?.error) throw new Error(`queue: ${searched.error.message}`);

  const [review, refund, search] = await Promise.all([
    db.from("orders").select(COLS).eq("status", "needs_review").order("created_at").returns<Row[]>(),
    db.from("orders").select(COLS).eq("refund_required", true).is("refunded_at", null).order("created_at").returns<Row[]>(),
    searched?.data
      ? db
          .from("orders")
          .select(COLS)
          .eq("user_id", searched.data.id)
          .order("created_at", { ascending: false })
          .limit(20)
          .returns<Row[]>()
      : null,
  ]);
  for (const r of [review, refund, search]) if (r?.error) throw new Error(`queue: ${r.error.message}`);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8">
      <Link href="/dashboard" className="text-sm text-muted-foreground">
        {th.staff.nav.back}
      </Link>
      <h1 className="text-2xl font-semibold">{th.staff.queue.title}</h1>

      <form className="flex gap-2">
        <Input name="q" defaultValue={q} placeholder={th.staff.queue.search} inputMode="numeric" />
        <Button type="submit">{th.staff.queue.searchButton}</Button>
      </form>

      {searched && <OrderList title={th.staff.queue.searchResults} rows={search?.data ?? []} />}
      <OrderList title={th.staff.queue.needsReview} rows={review.data ?? []} />
      <OrderList title={th.staff.queue.refundDue} rows={refund.data ?? []} />
    </main>
  );
}

function OrderList({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {title} ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">{th.staff.queue.empty}</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
            <div>
              <p className="font-medium">
                {r.profiles?.student_id} · {r.profiles?.first_name} {r.profiles?.last_name}
              </p>
              <p className="text-muted-foreground">
                {r.business_date} · {formatBaht(r.amount_satang)} บาท · {th.staff.order.statuses[r.status]}
                {r.review_reason && ` · ${th.order.reviewReasons[r.review_reason] ?? r.review_reason}`}
              </p>
            </div>
            <Link href={`/dashboard/orders/${r.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {th.staff.queue.open}
            </Link>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

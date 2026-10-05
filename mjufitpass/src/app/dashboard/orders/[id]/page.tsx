import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireArea } from "@/lib/auth/viewer";
import { formatBaht } from "@/lib/sales";
import { createAdminClient } from "@/lib/supabase/admin";
import { bangkokDate, bangkokTime } from "@/lib/time";
import { th } from "@/messages/th";
import { OrderActionsForm } from "./order-actions-form";

export default async function StaffOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireArea("staff");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const db = createAdminClient();
  const { data: order, error } = await db.from("orders").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`load order: ${error.message}`);
  if (!order) notFound();

  const [profile, slip, ticket, history] = await Promise.all([
    db.from("profiles").select("student_id, first_name, last_name, faculty, year_of_study, email").eq("id", order.user_id).maybeSingle(),
    db.from("slip_submissions").select("storage_path, amount_satang, reason").eq("order_id", id).maybeSingle(),
    db.from("tickets").select("status").eq("order_id", id).maybeSingle(),
    db.from("staff_actions").select("action, staff_email, note, created_at").eq("order_id", id).order("created_at"),
  ]);
  for (const r of [profile, slip, ticket, history]) if (r.error) throw new Error(`load order detail: ${r.error.message}`);

  const signed = slip.data ? await db.storage.from("slips").createSignedUrl(slip.data.storage_path, 300) : null;
  const t = th.staff.order;
  const p = profile.data;
  const refundDue = order.refund_required && !order.refunded_at;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-8">
      <Link href="/dashboard/queue" className="text-sm text-muted-foreground">
        ← {th.staff.queue.title}
      </Link>
      <h1 className="text-2xl font-semibold">{t.title}</h1>

      <Card>
        <CardContent className="flex flex-col gap-1 pt-4 text-sm">
          <p>
            {t.student}: {p?.student_id} · {p?.first_name} {p?.last_name}
          </p>
          <p className="text-muted-foreground">
            {p?.faculty} · {p?.email}
          </p>
          <p>
            {t.amount}: {formatBaht(order.amount_satang)} บาท · {t.date}: {order.business_date}
          </p>
          <p>
            {t.status}: {t.statuses[order.status]}
            {ticket.data && ` · ${t.ticket}: ${t.ticketStatuses[ticket.data.status]}`}
          </p>
          {order.review_reason && (
            <p>
              {t.reason}: {th.order.reviewReasons[order.review_reason] ?? order.review_reason}
            </p>
          )}
          {refundDue && <p className="font-medium text-destructive">{t.refundDue}</p>}
          {order.refunded_at && <p>{t.refunded(bangkokDate(new Date(order.refunded_at)))}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.slip}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {signed?.data ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, no optimizer needed
            <img src={signed.data.signedUrl} alt={t.slip} className="max-h-96 w-auto self-start rounded-lg border" />
          ) : (
            <p className="text-muted-foreground">{t.noSlip}</p>
          )}
          {slip.data?.amount_satang != null && (
            <p>
              {t.slipAmount}: {formatBaht(slip.data.amount_satang)} บาท
            </p>
          )}
        </CardContent>
      </Card>

      <OrderActionsForm
        orderId={id}
        available={{
          review: order.status === "needs_review",
          cancel: ticket.data?.status === "active",
          refund: refundDue,
        }}
      />

      {history.data && history.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t.history}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {history.data.map((h, i) => (
              <p key={i}>
                {bangkokDate(new Date(h.created_at))} {bangkokTime(new Date(h.created_at))} · {t.actions[h.action]} · {h.staff_email} — {h.note}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </main>
  );
}

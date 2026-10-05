import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireArea } from "@/lib/auth/viewer";
import { appNow } from "@/lib/clock";
import { formatBaht } from "@/lib/sales";
import { addDays, dailySales, entryHeatmap, salesTotals, slipStats, tally } from "@/lib/stats";
import { createAdminClient } from "@/lib/supabase/admin";
import { bangkokDate } from "@/lib/time";
import { th } from "@/messages/th";

export default async function DashboardPage() {
  const viewer = await requireArea("staff");
  if (viewer.kind !== "staff") return null;

  // ponytail: reads whole windows into memory, capped by PostgREST's row limit (1000 default);
  // move to SQL aggregates (RPC) if volume ever outgrows a campus gym.
  const db = createAdminClient();
  const now = await appNow();
  const today = bangkokDate(now);
  type OrderRow = {
    business_date: string;
    amount_satang: number;
    refunded_at: string | null;
    profiles: { faculty: string | null; year_of_study: number | null } | null;
  };
  const [orders, scans, slips, queue, refunds] = await Promise.all([
    db
      .from("orders")
      .select("business_date, amount_satang, refunded_at, profiles(faculty, year_of_study)")
      .eq("status", "paid")
      .gte("business_date", addDays(today, -35))
      .returns<OrderRow[]>(),
    db.from("gate_scans").select("scanned_at").eq("ok", true).gte("scanned_at", new Date(now.getTime() - 90 * 864e5).toISOString()).order("scanned_at", { ascending: false }).limit(1000),
    db.from("slip_submissions").select("verified, reason"),
    db.from("orders").select("id", { count: "exact", head: true }).eq("status", "needs_review"),
    db.from("orders").select("amount_satang").eq("refund_required", true).is("refunded_at", null),
  ]);
  for (const r of [orders, scans, slips, queue, refunds]) if (r.error) throw new Error(`dashboard: ${r.error.message}`);

  const paid = orders.data!.filter((o) => !o.refunded_at).map((o) => ({ businessDate: o.business_date, amountSatang: o.amount_satang }));
  const totals = salesTotals(paid, today);
  const series = dailySales(paid, today, 14);
  const maxDay = Math.max(1, ...series.map((d) => d.satang));
  const heat = entryHeatmap(scans.data!.map((r) => new Date(r.scanned_at)));
  const maxHeat = Math.max(1, ...heat.flat());
  const slip = slipStats(slips.data!);
  const st = th.staff.stats;
  const owed = refunds.data!.reduce((sum, o) => sum + o.amount_satang, 0);
  const thisMonth = orders.data!.filter((o) => !o.refunded_at && o.business_date.startsWith(today.slice(0, 7)));
  const byFaculty = tally(thisMonth.map((o) => o.profiles?.faculty ?? null), st.unknown);
  const byYear = tally(thisMonth.map((o) => o.profiles?.year_of_study ?? null), st.unknown)
    .map(([y, n]): [string, number] => [y === st.unknown ? y : st.year(y), n])
    .sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{th.staff.title}</h1>
          <p className="text-sm text-muted-foreground">
            {viewer.email} · {th.staff.roles[viewer.role]}
          </p>
        </div>
        <div className="w-40">
          <SignOutButton />
        </div>
      </header>
      <nav className="flex flex-wrap gap-2">
        <Link href="/dashboard/queue" className={buttonVariants()}>
          {st.queueLink(queue.count ?? 0)}
        </Link>
        <Link href="/dashboard/buyers" className={buttonVariants({ variant: "outline" })}>
          {th.staff.nav.buyers}
        </Link>
        <Link href="/kiosk" className={buttonVariants({ variant: "outline" })}>
          {th.staff.nav.kiosk}
        </Link>
        {viewer.role === "super_admin" && (
          <>
            <Link href="/dashboard/staff" className={buttonVariants({ variant: "outline" })}>
              {th.staff.nav.staff}
            </Link>
            <Link href="/dashboard/settings" className={buttonVariants({ variant: "outline" })}>
              {th.staff.nav.settings}
            </Link>
          </>
        )}
      </nav>
      <section className="grid gap-4 sm:grid-cols-4">
        {([["today", st.today], ["week", st.week], ["month", st.month]] as const).map(([key, label]) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatBaht(totals[key].satang)} ฿</p>
              <p className="text-sm text-muted-foreground">{st.tickets(totals[key].count)}</p>
            </CardContent>
          </Card>
        ))}
        <Link href="/dashboard/queue">
          <Card className={owed ? "ring-2 ring-destructive/50" : undefined}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{st.refundOwed}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-semibold ${owed ? "text-destructive" : ""}`}>{formatBaht(owed)} ฿</p>
              <p className="text-sm text-muted-foreground">{st.refundCount(refunds.data!.length)}</p>
            </CardContent>
          </Card>
        </Link>
      </section>
      <p className="-mt-3 text-xs text-muted-foreground">{st.note}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <BarList title={st.byFaculty} rows={byFaculty} />
        <BarList title={st.byYear} rows={byYear} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{st.daily}</CardTitle>
        </CardHeader>
        <CardContent className="flex h-36 items-end gap-1">
          {series.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${d.date}: ${formatBaht(d.satang)} ฿`}>
              <div className="w-full rounded-t bg-primary" style={{ height: `${(d.satang / maxDay) * 100}%`, minHeight: d.satang ? 2 : 0 }} />
              <span className="text-[10px] text-muted-foreground">{d.date.slice(8)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{st.heatmap}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="grid min-w-[36rem] gap-px" style={{ gridTemplateColumns: "2.5rem repeat(24, 1fr)" }}>
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="text-center text-[10px] text-muted-foreground">
                {h}
              </span>
            ))}
            {heat.map((row, d) => (
              <div key={d} className="contents">
                <span className="text-xs text-muted-foreground">{st.weekdays[d]}</span>
                {row.map((n, h) => (
                  <span
                    key={h}
                    title={`${st.weekdays[d]} ${h}:00 — ${n}`}
                    className="h-5 rounded-sm bg-primary"
                    style={{ opacity: n ? 0.15 + 0.85 * (n / maxHeat) : 0.05 }}
                  />
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{st.slips}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <p>{st.slipSummary(slip.total, slip.verified, slip.failed)}</p>
          {Object.entries(slip.reasons).map(([reason, n]) => (
            <p key={reason} className="text-muted-foreground">
              {th.order.reviewReasons[reason] ?? reason}: {n}
            </p>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}

function BarList({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {rows.length === 0 && <p className="text-muted-foreground">{th.staff.queue.empty}</p>}
        {rows.map(([label, n]) => (
          <div key={label} className="flex flex-col gap-1">
            <div className="flex justify-between gap-2">
              <span className="truncate">{label}</span>
              <span className="tabular-nums text-muted-foreground">{n}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${(n / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

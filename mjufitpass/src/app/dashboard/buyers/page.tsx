import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireArea } from "@/lib/auth/viewer";
import { BUYER_STATUSES, buyerQuery, parseBuyerFilter } from "@/lib/buyer-filter";
import { loadBuyers } from "@/lib/buyers";
import { FACULTIES, YEARS_OF_STUDY } from "@/lib/registration";
import { formatBaht } from "@/lib/sales";
import { th } from "@/messages/th";

const LIMIT = 200;
const SELECT = "h-9 rounded-md border border-input bg-transparent px-2 text-sm";
// Status colours; pending/expired (only reachable by search) stay muted.
const STATUS_COLOR: Record<string, string> = {
  paid: "text-emerald-600 dark:text-emerald-400",
  needs_review: "text-amber-600 dark:text-amber-400",
  rejected: "text-destructive",
};
const REFUND_DUE = "font-medium text-violet-600 dark:text-violet-400";
const REFUNDED = "text-sky-600 dark:text-sky-400";

export default async function BuyersPage({ searchParams }: PageProps<"/dashboard/buyers">) {
  await requireArea("staff");
  const f = parseBuyerFilter(await searchParams);
  const rows = await loadBuyers(f, LIMIT);
  const query = buyerQuery(f);
  const here = `/dashboard/buyers${query && `?${query}`}`;
  const b = th.staff.buyers;
  // A drill-down can carry a faculty outside today's list (the DB doesn't constrain it).
  const faculties: readonly string[] = f.faculty && !(FACULTIES as readonly string[]).includes(f.faculty) ? [...FACULTIES, f.faculty] : FACULTIES;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 pb-8">
      <h2 className="text-xl font-semibold">{f.status === "all" ? b.title : b.statuses[f.status]}</h2>
      {/* key: client navigation reuses this form, so remount it to pick up the new defaults */}
      <form key={query} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input name="q" defaultValue={f.q} placeholder={b.search} />
          <Button type="submit">{b.filter}</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select name="status" defaultValue={f.status} className={SELECT} aria-label={th.staff.order.status}>
            {BUYER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {b.statuses[s]}
              </option>
            ))}
          </select>
          <select name="faculty" defaultValue={f.faculty} className={`${SELECT} max-w-56`} aria-label={b.allFaculties}>
            <option value="">{b.allFaculties}</option>
            {faculties.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <select name="year" defaultValue={f.year} className={SELECT} aria-label={b.allYears}>
            <option value="">{b.allYears}</option>
            {YEARS_OF_STUDY.map((y) => (
              <option key={y} value={y}>
                {th.staff.stats.year(String(y))}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1">
            {b.from}
            <input type="date" name="from" defaultValue={f.from} className={SELECT} />
          </label>
          <label className="flex items-center gap-1">
            {b.to}
            <input type="date" name="to" defaultValue={f.to} className={SELECT} />
          </label>
          {query && (
            <Link href="/dashboard/buyers" className="text-muted-foreground underline-offset-2 hover:underline">
              {b.clear}
            </Link>
          )}
          <Link
            href={`/dashboard/buyers/export${query && `?${query}`}`}
            prefetch={false}
            className={`${buttonVariants({ variant: "outline", size: "sm" })} ml-auto`}
          >
            {b.export}
          </Link>
        </div>
      </form>
      <Card>
        <CardContent className="flex flex-col gap-2 pt-4">
          {rows.length === 0 && <p className="text-sm text-muted-foreground">{b.empty}</p>}
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <div>
                <Link
                  href={`/dashboard/buyers?${buyerQuery({ q: r.profiles?.student_id ?? "" })}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {r.profiles?.student_id}
                </Link>{" "}
                {r.profiles?.first_name} {r.profiles?.last_name}
                <p className="text-muted-foreground">
                  {r.business_date} · {formatBaht(r.amount_satang)} บาท ·{" "}
                  <span className={STATUS_COLOR[r.status]}>{th.staff.order.statuses[r.status]}</span>
                  {r.review_reason && r.status !== "paid" && ` · ${th.order.reviewReasons[r.review_reason] ?? r.review_reason}`}
                  {r.refund_required && !r.refunded_at && <span className={REFUND_DUE}> · {b.refundDue}</span>}
                  {r.refunded_at && <span className={REFUNDED}> · {b.refunded}</span>}
                </p>
              </div>
              <Link
                href={`/dashboard/orders/${r.id}?back=${encodeURIComponent(here)}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {th.staff.queue.open}
              </Link>
            </div>
          ))}
          {rows.length === LIMIT && <p className="text-xs text-muted-foreground">{b.limit}</p>}
        </CardContent>
      </Card>
    </main>
  );
}

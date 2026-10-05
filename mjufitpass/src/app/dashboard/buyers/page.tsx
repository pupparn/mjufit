import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireArea } from "@/lib/auth/viewer";
import { loadBuyers } from "@/lib/buyers";
import { formatBaht } from "@/lib/sales";
import { th } from "@/messages/th";

export default async function BuyersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireArea("staff");
  const q = ((await searchParams).q ?? "").trim().slice(0, 50);
  const rows = await loadBuyers(q, 200);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8">
      <Link href="/dashboard" className="text-sm text-muted-foreground">
        {th.staff.nav.back}
      </Link>
      <h1 className="text-2xl font-semibold">{th.staff.buyers.title}</h1>
      <form className="flex gap-2">
        <Input name="q" defaultValue={q} placeholder={th.staff.buyers.search} />
        <Button type="submit">{th.staff.queue.searchButton}</Button>
        <Link
          href={`/dashboard/buyers/export?q=${encodeURIComponent(q)}`}
          prefetch={false}
          className={buttonVariants({ variant: "outline" })}
        >
          {th.staff.buyers.export}
        </Link>
      </form>
      <Card>
        <CardContent className="flex flex-col gap-2 pt-4">
          {rows.length === 0 && <p className="text-sm text-muted-foreground">{th.staff.buyers.empty}</p>}
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <div>
                <Link href={`/dashboard/buyers?q=${r.profiles?.student_id}`} className="font-medium underline-offset-2 hover:underline">
                  {r.profiles?.student_id}
                </Link>{" "}
                {r.profiles?.first_name} {r.profiles?.last_name}
                <p className="text-muted-foreground">
                  {r.business_date} · {formatBaht(r.amount_satang)} บาท · {th.staff.order.statuses[r.status]}
                  {r.refund_required && !r.refunded_at && " · ต้องคืนเงิน"}
                </p>
              </div>
              <Link href={`/dashboard/orders/${r.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                {th.staff.queue.open}
              </Link>
            </div>
          ))}
          {rows.length === 200 && <p className="text-xs text-muted-foreground">{th.staff.buyers.limit}</p>}
        </CardContent>
      </Card>
    </main>
  );
}

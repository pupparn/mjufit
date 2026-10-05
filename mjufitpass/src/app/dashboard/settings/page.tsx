import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSuperAdmin } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { hhmm } from "@/lib/time";
import { th } from "@/messages/th";
import { removeClosedDateAction } from "./actions";
import { ClosedDateForm, SettingsForm } from "./settings-forms";

export default async function SettingsPage() {
  await requireSuperAdmin();
  const db = createAdminClient();
  const [settings, closed] = await Promise.all([
    db.from("settings").select("*").eq("id", 1).single(),
    db.from("closed_dates").select("date, note").order("date"),
  ]);
  if (settings.error) throw new Error(`load settings: ${settings.error.message}`);
  if (closed.error) throw new Error(`load closed dates: ${closed.error.message}`);
  const s = settings.data;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-8">
      <Link href="/dashboard" className="text-sm text-muted-foreground">
        {th.staff.nav.back}
      </Link>
      <h1 className="text-2xl font-semibold">{th.staff.admin.settingsTitle}</h1>
      <SettingsForm
        price={String(s.price_satang / 100)}
        openTime={hhmm(s.open_time)}
        salesCutoff={hhmm(s.sales_cutoff)}
        closeTime={hhmm(s.close_time)}
        orderTtl={s.order_ttl_minutes}
      />
      <Card>
        <CardHeader>
          <CardTitle>{th.staff.admin.closedTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ClosedDateForm />
          {closed.data.length === 0 && <p className="text-sm text-muted-foreground">{th.staff.admin.closedEmpty}</p>}
          {closed.data.map((d) => (
            <div key={d.date} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <span>
                {d.date}
                {d.note && ` · ${d.note}`}
              </span>
              <form action={removeClosedDateAction}>
                <input type="hidden" name="date" value={d.date} />
                <Button type="submit" variant="outline" size="sm">
                  {th.staff.admin.closedRemove}
                </Button>
              </form>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}

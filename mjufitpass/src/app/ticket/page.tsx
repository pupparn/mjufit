import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AREA_PATHS } from "@/lib/auth/access";
import { requireArea } from "@/lib/auth/viewer";
import { appNow, clockOffsetMs } from "@/lib/clock";
import { createClient } from "@/lib/supabase/server";
import { ticketValidity } from "@/lib/tickets/validity";
import { bangkokDate, hhmm } from "@/lib/time";
import { th } from "@/messages/th";
import { GatePassQr } from "./gate-pass-qr";

const thaiDate = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "long" });

export default async function TicketPage() {
  const viewer = await requireArea("student");
  if (viewer.kind !== "student") return null;

  const [now, offsetMs, supabase] = await Promise.all([appNow(), clockOffsetMs(), createClient()]);
  const today = bangkokDate(now);

  // Read with the student's own session: RLS limits this to their ticket,
  // and the secret never passes through an admin client.
  const [ticketResult, settingsResult] = await Promise.all([
    supabase
      .from("tickets")
      .select("id, status, business_date, totp_secret")
      .eq("user_id", viewer.id)
      .eq("business_date", today)
      .maybeSingle(),
    supabase.from("settings").select("close_time").eq("id", 1).single(),
  ]);
  if (ticketResult.error) throw new Error(`load ticket: ${ticketResult.error.message}`);
  if (settingsResult.error) throw new Error(`load settings: ${settingsResult.error.message}`);

  const ticket = ticketResult.data;
  const closeTime = settingsResult.data.close_time;
  const backLink = (
    <Link href={AREA_PATHS.student} className={buttonVariants({ variant: "outline", size: "lg" })}>
      {th.ticket.back}
    </Link>
  );

  if (!ticket) {
    return (
      <PageShell>
        <Card>
          <CardHeader>
            <CardTitle>{th.ticket.none}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col">{backLink}</CardContent>
        </Card>
      </PageShell>
    );
  }

  const validity = ticketValidity({ status: ticket.status, businessDate: ticket.business_date }, now, {
    closeTime,
  });

  return (
    <PageShell>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{th.ticket.title}</CardTitle>
          <CardDescription>
            {viewer.firstName} {viewer.lastName} · {viewer.studentId}
            <br />
            {th.ticket.validUntil(thaiDate.format(now), hhmm(closeTime))}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {validity === "valid" ? (
            <>
              <p className="text-sm">{th.ticket.scanHint}</p>
              <GatePassQr ticketId={ticket.id} secret={ticket.totp_secret} offsetMs={offsetMs} />
              <p className="text-center text-xs text-muted-foreground">{th.ticket.antiScreenshot}</p>
            </>
          ) : (
            <p className="w-full rounded-lg bg-muted p-3 text-center text-sm">{th.ticket.state[validity]}</p>
          )}
        </CardContent>
      </Card>
      {backLink}
    </PageShell>
  );
}

import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { SignOutButton } from "@/components/sign-out-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireArea } from "@/lib/auth/viewer";
import { appNow } from "@/lib/clock";
import { getTodayState, type TodayState } from "@/lib/orders";
import { formatBaht } from "@/lib/sales";
import { th } from "@/messages/th";
import { startOrder } from "./actions";

export default async function StudentHomePage() {
  const viewer = await requireArea("student");
  if (viewer.kind !== "student") return null;

  const today = await getTodayState(viewer.id, await appNow());

  return (
    <PageShell>
      <Card>
        <CardHeader>
          <CardTitle>{th.student.greeting(`${viewer.firstName} ${viewer.lastName}`)}</CardTitle>
          <CardDescription>
            {th.student.studentId}: {viewer.studentId}
            {viewer.faculty && viewer.yearOfStudy && (
              <>
                <br />
                {th.student.profile(viewer.faculty, viewer.yearOfStudy)}
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <TodayAction today={today} />
          <SignOutButton />
        </CardContent>
      </Card>
    </PageShell>
  );
}

function TodayAction({ today }: { today: TodayState }) {
  const { order, sales } = today;

  if (order?.status === "paid") {
    return (
      <>
        <p className="text-sm font-medium">{th.student.hasTicket}</p>
        <Link href="/ticket" className={buttonVariants({ size: "lg" })}>
          {th.student.openTicket}
        </Link>
      </>
    );
  }

  if (order) {
    return (
      <Link href={`/orders/${order.id}`} className={buttonVariants({ size: "lg" })}>
        {order.status === "pending_payment" ? th.student.continueOrder : th.student.viewOrder}
      </Link>
    );
  }

  if (!sales.open) {
    return <p className="rounded-lg bg-muted p-3 text-sm">{th.student.closed[sales.reason]}</p>;
  }

  return (
    <form action={startOrder} className="flex flex-col gap-2">
      <Button type="submit" size="lg">
        {th.student.buyPass(formatBaht(today.priceSatang))}
      </Button>
      <p className="text-center text-xs text-muted-foreground">{th.student.passRules}</p>
    </form>
  );
}

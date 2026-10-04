import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AREA_PATHS } from "@/lib/auth/access";
import { requireArea } from "@/lib/auth/viewer";
import { appNow, clockOffsetMs } from "@/lib/clock";
import { getOwnOrder, type Order } from "@/lib/orders";
import { promptPayId, slipVerifierMode } from "@/lib/payments/config";
import { promptPayQrSvg } from "@/lib/payments/promptpay";
import { formatBaht } from "@/lib/sales";
import { th } from "@/messages/th";
import { ExpiryCountdown, OrderStatusWatcher } from "./order-live";
import { SlipForm } from "./slip-form";

export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const viewer = await requireArea("student");
  if (viewer.kind !== "student") return null;

  const { id } = await params;
  const order = await getOwnOrder(viewer.id, id);
  if (!order) notFound();

  // A pending order past its deadline is expired, even before the DB catches up.
  const [now, offsetMs] = await Promise.all([appNow(), clockOffsetMs()]);
  const pending = order.status === "pending_payment" && order.expiresAt > now;

  return (
    <PageShell>
      <OrderStatusWatcher orderId={order.id} />
      {pending ? <PendingPayment order={order} offsetMs={offsetMs} /> : <OrderResult order={order} />}
    </PageShell>
  );
}

async function PendingPayment({ order, offsetMs }: { order: Order; offsetMs: number }) {
  const svg = await promptPayQrSvg(promptPayId(), order.amountSatang);
  const mockMode = slipVerifierMode() === "mock";

  return (
    <>
      {mockMode && (
        <p role="note" className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm font-medium">
          {th.order.demoBanner}
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{th.order.title}</CardTitle>
          <CardDescription>{th.order.scanToPay}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <div
            className="w-full max-w-64 rounded-lg bg-white p-2"
            role="img"
            aria-label="PromptPay QR"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <p className="text-2xl font-semibold">{th.order.amount(formatBaht(order.amountSatang))}</p>
          <p className="text-sm text-muted-foreground">
            {th.order.expiresIn} <ExpiryCountdown expiresAt={order.expiresAt.toISOString()} offsetMs={offsetMs} />
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{th.order.uploadTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <SlipForm orderId={order.id} mockMode={mockMode} />
        </CardContent>
      </Card>
    </>
  );
}

function OrderResult({ order }: { order: Order }) {
  const s = th.order.status;
  const reason = order.reviewReason
    ? (th.order.reviewReasons[order.reviewReason] ?? th.order.reviewReasons.unknown)
    : null;

  const view = {
    paid: { title: s.paid, hint: null },
    needs_review: { title: s.needs_review, hint: s.needsReviewHint },
    rejected: { title: s.rejected, hint: null },
    expired: { title: s.expired, hint: s.expiredHint },
    pending_payment: { title: s.expired, hint: s.expiredHint }, // past deadline
  }[order.status];

  const canStartOver = order.status === "expired" || order.status === "pending_payment" || order.status === "rejected";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{view.title}</CardTitle>
        {reason && <CardDescription>{reason}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {view.hint && <p className="text-sm text-muted-foreground">{view.hint}</p>}
        {order.status === "paid" && (
          <Link href="/ticket" className={buttonVariants({ size: "lg" })}>
            {th.student.openTicket}
          </Link>
        )}
        <Link
          href={AREA_PATHS.student}
          className={buttonVariants({ size: "lg", variant: canStartOver ? "default" : "outline" })}
        >
          {canStartOver ? th.order.newOrder : th.order.backHome}
        </Link>
      </CardContent>
    </Card>
  );
}

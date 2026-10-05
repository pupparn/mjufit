"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { th } from "@/messages/th";
import { orderAction, type OrderActionState } from "./actions";

export type AvailableActions = { review: boolean; cancel: boolean; refund: boolean };

export function OrderActionsForm({ orderId, available }: { orderId: string; available: AvailableActions }) {
  const [state, formAction, pending] = useActionState(orderAction.bind(null, orderId), { error: null } as OrderActionState);
  const t = th.staff.order;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Label htmlFor="note">{t.note}</Label>
      <textarea
        id="note"
        name="note"
        required
        rows={3}
        className="w-full rounded-lg border bg-transparent p-2 text-sm"
      />
      {(available.review || available.cancel) && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="refund" />
          {t.moneyReceived}
        </label>
      )}
      {available.review && <p className="text-xs text-muted-foreground">{t.lateApproveHint}</p>}
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {available.review && (
          <>
            <Button type="submit" name="intent" value="approve" disabled={pending}>
              {t.approve}
            </Button>
            <Button type="submit" name="intent" value="reject" variant="destructive" disabled={pending}>
              {t.reject}
            </Button>
          </>
        )}
        {available.cancel && (
          <Button type="submit" name="intent" value="cancel" variant="destructive" disabled={pending}>
            {t.cancelTicket}
          </Button>
        )}
        {available.refund && (
          <Button type="submit" name="intent" value="refunded" variant="outline" disabled={pending}>
            {t.markRefunded}
          </Button>
        )}
      </div>
    </form>
  );
}

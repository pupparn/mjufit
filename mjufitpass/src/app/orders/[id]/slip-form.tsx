"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MOCK_OUTCOMES } from "@/lib/payments/mock";
import { SLIP_ACCEPT } from "@/lib/payments/slip-file";
import { th } from "@/messages/th";
import { submitSlipAction, type SlipFormState } from "./actions";

const initialState: SlipFormState = { error: null };

export function SlipForm({ orderId, mockMode }: { orderId: string; mockMode: boolean }) {
  const [state, formAction, pending] = useActionState(
    submitSlipAction.bind(null, orderId),
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Label htmlFor="slip">{th.order.slipLabel}</Label>
      <Input id="slip" name="slip" type="file" accept={SLIP_ACCEPT} required />
      <p className="text-xs text-muted-foreground">{th.order.uploadHint}</p>

      {mockMode && (
        <fieldset className="flex flex-col gap-2 rounded-lg border border-dashed p-3 text-sm">
          <legend className="px-1 text-xs font-medium text-muted-foreground">{th.order.mock.title}</legend>
          {MOCK_OUTCOMES.map((outcome, i) => (
            <label key={outcome} className="flex items-center gap-2">
              <input type="radio" name="mockOutcome" value={outcome} defaultChecked={i === 0} />
              {th.order.mock[outcome]}
            </label>
          ))}
        </fieldset>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? th.order.submitting : th.order.submit}
      </Button>
    </form>
  );
}

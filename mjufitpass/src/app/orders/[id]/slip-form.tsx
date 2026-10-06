"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MOCK_OUTCOMES } from "@/lib/payments/mock";
import { SLIP_ACCEPT, SLIP_MAX_BYTES } from "@/lib/payments/slip-file";
import { th } from "@/messages/th";
import { submitSlipAction, type SlipFormState } from "./actions";

const initialState: SlipFormState = { error: null };

export function SlipForm({ orderId, mockMode }: { orderId: string; mockMode: boolean }) {
  const [state, formAction, pending] = useActionState(
    submitSlipAction.bind(null, orderId),
    initialState,
  );
  // Files over the server action body limit never reach validateSlipFile, so check size here.
  const [sizeError, setSizeError] = useState<string | null>(null);
  const error = sizeError ?? state.error;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Label htmlFor="slip">{th.order.slipLabel}</Label>
      <Input
        id="slip"
        name="slip"
        type="file"
        accept={SLIP_ACCEPT}
        required
        onChange={(e) => {
          const tooLarge = (e.target.files?.[0]?.size ?? 0) > SLIP_MAX_BYTES;
          if (tooLarge) e.target.value = "";
          setSizeError(tooLarge ? th.order.errors.too_large : null);
        }}
      />
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

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? th.order.submitting : th.order.submit}
      </Button>
    </form>
  );
}

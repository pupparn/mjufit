"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { th } from "@/messages/th";
import {
  addClosedDateAction,
  saveSettingsAction,
  type SettingsFormState,
} from "./actions";

const a = th.staff.admin;
const initial: SettingsFormState = { error: null };

function FormStatus({ state }: { state: SettingsFormState }) {
  if (state.error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    );
  return state.saved ? <p className="text-sm text-muted-foreground">{a.saved}</p> : null;
}

export function SettingsForm(props: {
  price: string;
  openTime: string;
  salesCutoff: string;
  closeTime: string;
  orderTtl: number;
}) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, initial);
  const fields = [
    { name: "price", label: a.price, type: "text", value: props.price },
    { name: "openTime", label: a.openTime, type: "time", value: props.openTime },
    { name: "salesCutoff", label: a.salesCutoff, type: "time", value: props.salesCutoff },
    { name: "closeTime", label: a.closeTime, type: "time", value: props.closeTime },
    { name: "orderTtl", label: a.orderTtl, type: "number", value: String(props.orderTtl) },
  ];
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {fields.map((f) => (
        <div key={f.name} className="flex flex-col gap-1">
          <Label htmlFor={f.name}>{f.label}</Label>
          <Input id={f.name} name={f.name} type={f.type} defaultValue={f.value} required />
        </div>
      ))}
      <FormStatus state={state} />
      <Button type="submit" disabled={pending}>
        {a.save}
      </Button>
    </form>
  );
}

export function ClosedDateForm() {
  const [state, formAction, pending] = useActionState(addClosedDateAction, initial);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Input name="date" type="date" required aria-label={a.closedDate} className="w-auto" />
        <Input name="note" placeholder={a.closedNote} aria-label={a.closedNote} className="flex-1" />
        <Button type="submit" disabled={pending}>
          {a.closedAdd}
        </Button>
      </div>
      <FormStatus state={state} />
    </form>
  );
}

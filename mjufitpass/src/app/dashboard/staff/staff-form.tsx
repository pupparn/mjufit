"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { th } from "@/messages/th";
import { addStaffAction, type StaffFormState } from "./actions";

export function AddStaffForm() {
  const [state, formAction, pending] = useActionState(addStaffAction, { error: null } as StaffFormState);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Label htmlFor="email">{th.staff.admin.staffAdd}</Label>
      <div className="flex gap-2">
        <Input id="email" name="email" type="email" required />
        <Button type="submit" disabled={pending}>
          {th.staff.admin.staffAddButton}
        </Button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/viewer";
import { parseSettings } from "@/lib/settings-input";
import { logStaffAction } from "@/lib/staff-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { th } from "@/messages/th";

export type SettingsFormState = { error: string | null; saved?: boolean };

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "");

export async function saveSettingsAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const viewer = await requireSuperAdmin();
  const parsed = parseSettings({
    price: field(formData, "price"),
    openTime: field(formData, "openTime"),
    salesCutoff: field(formData, "salesCutoff"),
    closeTime: field(formData, "closeTime"),
    orderTtl: field(formData, "orderTtl"),
  });
  if (!parsed.ok) return { error: th.staff.admin.settingsErrors[parsed.error] };

  const db = createAdminClient();
  const { error } = await db
    .from("settings")
    .update({ ...parsed.row, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { error: th.staff.admin.settingsErrors.unknown };

  await logStaffAction(db, { staffEmail: viewer.email, action: "update_settings", note: JSON.stringify(parsed.row) });
  revalidatePath("/dashboard/settings");
  return { error: null, saved: true };
}

const closedDateSchema = z.object({
  date: z.iso.date(),
  note: z.string().trim().max(200),
});

export async function addClosedDateAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const viewer = await requireSuperAdmin();
  const parsed = closedDateSchema.safeParse({ date: field(formData, "date"), note: field(formData, "note") });
  if (!parsed.success) return { error: th.staff.admin.settingsErrors.invalid_date };

  const db = createAdminClient();
  const { error } = await db
    .from("closed_dates")
    .upsert({ date: parsed.data.date, note: parsed.data.note || null }, { onConflict: "date" });
  if (error) return { error: th.staff.admin.settingsErrors.unknown };

  await logStaffAction(db, { staffEmail: viewer.email, action: "add_closed_date", note: parsed.data.date });
  revalidatePath("/dashboard/settings");
  return { error: null };
}

export async function removeClosedDateAction(formData: FormData): Promise<void> {
  const viewer = await requireSuperAdmin();
  const date = z.iso.date().safeParse(formData.get("date"));
  if (!date.success) return;

  const db = createAdminClient();
  const { error } = await db.from("closed_dates").delete().eq("date", date.data);
  if (error) throw new Error(`remove closed date: ${error.message}`);
  await logStaffAction(db, { staffEmail: viewer.email, action: "remove_closed_date", note: date.data });
  revalidatePath("/dashboard/settings");
}

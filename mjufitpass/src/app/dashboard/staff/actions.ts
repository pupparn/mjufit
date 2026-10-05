"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/viewer";
import { logStaffAction } from "@/lib/staff-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { th } from "@/messages/th";

export type StaffFormState = { error: string | null };

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export async function addStaffAction(_prev: StaffFormState, formData: FormData): Promise<StaffFormState> {
  const viewer = await requireSuperAdmin();
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { error: th.staff.admin.staffErrors.invalid_email };

  const db = createAdminClient();
  const { error } = await db.from("staff_members").insert({ email: email.data, role: "staff" });
  if (error?.code === "23505") return { error: th.staff.admin.staffErrors.exists };
  if (error) return { error: th.staff.admin.staffErrors.unknown };

  await logStaffAction(db, { staffEmail: viewer.email, action: "add_staff", note: email.data });
  revalidatePath("/dashboard/staff");
  return { error: null };
}

export async function removeStaffAction(formData: FormData): Promise<void> {
  const viewer = await requireSuperAdmin();
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success || email.data === viewer.email) return;

  const db = createAdminClient();
  // Only plain staff are removable; super admins are managed via SUPER_ADMIN_EMAIL + seed.
  const { data, error } = await db
    .from("staff_members")
    .delete()
    .eq("email", email.data)
    .eq("role", "staff")
    .select("email");
  if (error) throw new Error(`remove staff: ${error.message}`);
  if (data.length) await logStaffAction(db, { staffEmail: viewer.email, action: "remove_staff", note: email.data });
  revalidatePath("/dashboard/staff");
}

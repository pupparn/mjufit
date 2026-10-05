import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StaffActionType } from "@/lib/supabase/database.types";

/** Appends to the staff audit log; throws so a failed log fails the action. */
export async function logStaffAction(
  admin: ReturnType<typeof createAdminClient>,
  entry: { staffEmail: string; action: StaffActionType; note?: string },
) {
  const { error } = await admin
    .from("staff_actions")
    .insert({ staff_email: entry.staffEmail, action: entry.action, note: entry.note ?? null });
  if (error) throw new Error(`audit log: ${error.message}`);
}

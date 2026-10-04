"use server";

import { redirect } from "next/navigation";
import { AREA_PATHS } from "@/lib/auth/access";
import { requireArea } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

export async function acceptConsent() {
  await requireArea("consent");
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_consent");
  if (error) throw new Error(`accept_consent failed: ${error.message}`);
  redirect(AREA_PATHS.register);
}

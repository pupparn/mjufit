// Upserts SUPER_ADMIN_EMAIL into staff_members as super_admin.
// Usage: npm run seed   (reads .env.local)
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name} (see .env.example)`);
  return value;
}

async function main() {
  const email = requireEnv("SUPER_ADMIN_EMAIL").trim().toLowerCase();
  const supabase = createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error } = await supabase
    .from("staff_members")
    .upsert({ email, role: "super_admin" }, { onConflict: "email" });
  if (error) throw error;

  console.log(`super_admin set: ${email}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

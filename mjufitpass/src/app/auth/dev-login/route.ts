import { NextResponse, type NextRequest } from "next/server";
import { devClockEnabled } from "@/lib/clock";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// E2E-only sign-in that skips Google: /auth/dev-login?email=…
// Exists only in `next dev` with E2E_TEST_LOGIN=1 (set by playwright.config.ts).
export async function GET(request: NextRequest) {
  if (!devClockEnabled() || process.env.E2E_TEST_LOGIN !== "1") {
    return new NextResponse(null, { status: 404 });
  }

  const email = request.nextUrl.searchParams.get("email")?.toLowerCase() ?? "";
  const name = request.nextUrl.searchParams.get("name") ?? "E2E Tester";
  const admin = createAdminClient();
  const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: name } });
  if (created.error && created.error.code !== "email_exists") {
    return NextResponse.json({ error: created.error.message }, { status: 500 });
  }

  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) return NextResponse.json({ error: link.error.message }, { status: 500 });

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.redirect(new URL("/", request.url));
}

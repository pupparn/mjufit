import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AREA_PATHS, redirectFor, type Area, type Viewer } from "./access";

/** The current viewer, resolved once per request. */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return { kind: "anonymous" };

  const email = String(claims.email ?? "").toLowerCase();

  const [roleResult, profileResult] = await Promise.all([
    supabase.rpc("current_staff_role"),
    supabase
      .from("profiles")
      .select("full_name, first_name, last_name, student_id, faculty, year_of_study, consent_at, registered_at")
      .eq("id", claims.sub)
      .maybeSingle(),
  ]);

  // Fail loudly: treating an error as "no role" / "no consent" would cause
  // wrong-area access or a redirect loop instead of an error page.
  if (roleResult.error) throw new Error(`current_staff_role failed: ${roleResult.error.message}`);
  if (profileResult.error) throw new Error(`profile lookup failed: ${profileResult.error.message}`);

  const role = roleResult.data;
  const profile = profileResult.data;
  if (role) return { kind: "staff", role, email };

  return {
    kind: "student",
    id: claims.sub,
    email,
    fullName: profile?.full_name ?? null,
    firstName: profile?.first_name ?? null,
    lastName: profile?.last_name ?? null,
    studentId: profile?.student_id ?? null,
    faculty: profile?.faculty ?? null,
    yearOfStudy: profile?.year_of_study ?? null,
    consented: Boolean(profile?.consent_at),
    registered: Boolean(profile?.registered_at),
  };
});

/** Redirects away unless the viewer belongs in `area`; returns the viewer. */
export async function requireArea<A extends Area>(area: A): Promise<Viewer> {
  const viewer = await getViewer();
  const target = redirectFor(viewer, area);
  if (target) redirect(target);
  return viewer;
}

/** Staff area, super admins only; plain staff go back to the dashboard. */
export async function requireSuperAdmin(): Promise<Extract<Viewer, { kind: "staff" }>> {
  const viewer = await requireArea("staff");
  if (viewer.kind !== "staff") redirect(AREA_PATHS.login);
  if (viewer.role !== "super_admin") redirect(AREA_PATHS.staff);
  return viewer;
}

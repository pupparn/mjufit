import type { StaffRole } from "@/lib/supabase/database.types";

export type Viewer =
  | { kind: "anonymous" }
  | { kind: "staff"; role: StaffRole; email: string }
  | {
      kind: "student";
      id: string;
      email: string;
      fullName: string | null; // from Google
      firstName: string | null;
      lastName: string | null;
      studentId: string | null;
      faculty: string | null;
      yearOfStudy: number | null;
      consented: boolean;
      registered: boolean;
    };

/** Areas of the app; each page declares which one it belongs to. */
export type Area = "login" | "consent" | "register" | "student" | "staff";

export const AREA_PATHS: Record<Area, string> = {
  login: "/login",
  consent: "/onboarding/consent",
  register: "/onboarding/register",
  student: "/me",
  staff: "/dashboard",
};

/** Where this viewer belongs right now. */
export function homeArea(viewer: Viewer): Area {
  switch (viewer.kind) {
    case "anonymous":
      return "login";
    case "staff":
      return "staff";
    case "student":
      if (!viewer.consented) return "consent";
      if (!viewer.registered) return "register";
      return "student";
  }
}

/**
 * Returns the path to redirect to, or null if the viewer may see `area`.
 * Every area has exactly one allowed state, so this is just "are you home?".
 */
export function redirectFor(viewer: Viewer, area: Area): string | null {
  const home = homeArea(viewer);
  return home === area ? null : AREA_PATHS[home];
}

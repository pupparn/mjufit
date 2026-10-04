import { describe, expect, it } from "vitest";
import { homeArea, redirectFor, type Area, type Viewer } from "./access";

const anonymous: Viewer = { kind: "anonymous" };
const staff: Viewer = { kind: "staff", role: "staff", email: "s@gmail.com" };
const superAdmin: Viewer = { kind: "staff", role: "super_admin", email: "a@gmail.com" };
const student = (over: Partial<Extract<Viewer, { kind: "student" }>> = {}): Viewer => ({
  kind: "student",
  id: "00000000-0000-0000-0000-000000000001",
  email: "st@gmail.com",
  fullName: "Student",
  firstName: "Somchai",
  lastName: "Jaidee",
  studentId: "6512345678",
  faculty: "คณะวิทยาศาสตร์",
  yearOfStudy: 2,
  consented: true,
  registered: true,
  ...over,
});

const ALL_AREAS: Area[] = ["login", "consent", "register", "student", "staff"];

describe("homeArea", () => {
  it.each<[string, Viewer, Area]>([
    ["anonymous", anonymous, "login"],
    ["staff", staff, "staff"],
    ["super admin", superAdmin, "staff"],
    ["student without consent", student({ consented: false, registered: false }), "consent"],
    ["student with consent, not registered", student({ registered: false }), "register"],
    ["legacy student with ID but not registered", student({ registered: false, firstName: null }), "register"],
    ["onboarded student", student(), "student"],
  ])("%s → %s", (_label, viewer, area) => {
    expect(homeArea(viewer)).toBe(area);
  });

  it("asks for consent before registration even if already registered", () => {
    expect(homeArea(student({ consented: false }))).toBe("consent");
  });
});

describe("redirectFor", () => {
  it("lets each viewer into exactly one area", () => {
    for (const viewer of [anonymous, staff, superAdmin, student(), student({ registered: false })]) {
      const allowed = ALL_AREAS.filter((area) => redirectFor(viewer, area) === null);
      expect(allowed).toEqual([homeArea(viewer)]);
    }
  });

  it("keeps students out of the dashboard", () => {
    expect(redirectFor(student(), "staff")).toBe("/me");
  });

  it("sends staff past onboarding", () => {
    expect(redirectFor(staff, "consent")).toBe("/dashboard");
  });

  it("sends anonymous users to login", () => {
    expect(redirectFor(anonymous, "student")).toBe("/login");
  });
});

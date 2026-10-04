import { describe, expect, it } from "vitest";
import { FACULTIES, registrationErrorFromDb, registrationSchema, splitFullName } from "./registration";

const valid = {
  studentId: " 6512345678 ",
  firstName: "  สมชาย ",
  lastName: "ใจดี",
  faculty: FACULTIES[0],
  yearOfStudy: "2",
};

const issuesOf = (input: Record<string, unknown>) => {
  const result = registrationSchema.safeParse(input);
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
};

describe("registrationSchema", () => {
  it("accepts and normalises a valid form", () => {
    expect(registrationSchema.parse(valid)).toEqual({
      studentId: "6512345678",
      firstName: "สมชาย",
      lastName: "ใจดี",
      faculty: FACULTIES[0],
      yearOfStudy: 2,
    });
  });

  it("reports each bad field with a message key", () => {
    expect(
      issuesOf({ studentId: "12", firstName: " ", lastName: "x".repeat(101), faculty: "คณะปลอม", yearOfStudy: "" }),
    ).toEqual({
      studentId: "invalid_format",
      firstName: "required",
      lastName: "too_long",
      faculty: "required",
      yearOfStudy: "required",
    });
  });

  it.each(["0", "9", "1.5", "abc"])("rejects year %s", (yearOfStudy) => {
    expect(issuesOf({ ...valid, yearOfStudy })).toHaveProperty("yearOfStudy");
  });

  it.each(["1", "8"])("accepts year %s", (yearOfStudy) => {
    expect(registrationSchema.safeParse({ ...valid, yearOfStudy }).success).toBe(true);
  });
});

describe("registrationErrorFromDb", () => {
  it("maps unique violation to duplicate", () => {
    expect(registrationErrorFromDb({ code: "23505" })).toBe("duplicate");
  });

  it.each(["already_registered", "student_id_locked", "consent_required"] as const)("maps %s", (key) => {
    expect(registrationErrorFromDb({ code: "P0001", message: key })).toBe(key);
  });

  it("falls back to unknown", () => {
    expect(registrationErrorFromDb({ code: "P0001", message: "invalid_input" })).toBe("unknown");
  });
});

describe("splitFullName", () => {
  it.each([
    ["Somchai Jaidee", "Somchai", "Jaidee"],
    ["  Somchai   Na Ayutthaya ", "Somchai", "Na Ayutthaya"],
    ["Somchai", "Somchai", ""],
    [null, "", ""],
  ])("splits %j", (name, firstName, lastName) => {
    expect(splitFullName(name)).toEqual({ firstName, lastName });
  });
});

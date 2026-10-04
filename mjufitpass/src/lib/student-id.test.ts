import { describe, expect, it } from "vitest";
import { studentIdSchema } from "./student-id";

describe("studentIdSchema", () => {
  it.each(["12345678", "123456789", "6512345678"])("accepts %s", (id) => {
    expect(studentIdSchema.safeParse(id).success).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    expect(studentIdSchema.parse("  6512345678 ")).toBe("6512345678");
  });

  it.each([
    ["too short", "1234567"],
    ["too long", "12345678901"],
    ["letters", "65123456a"],
    ["dash", "65-1234567"],
    ["inner space", "6512 345678"],
    ["empty", ""],
    ["thai digits", "๖๕๑๒๓๔๕๖"],
  ])("rejects %s", (_label, id) => {
    expect(studentIdSchema.safeParse(id).success).toBe(false);
  });
});

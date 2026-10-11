import { describe, expect, it } from "vitest";
import { buyerQuery, parseBuyerFilter, safeBack } from "./buyer-filter";

describe("parseBuyerFilter", () => {
  it("keeps valid values and round-trips through buyerQuery", () => {
    const f = parseBuyerFilter({ q: " 641 ", status: "refund_due", faculty: "คณะวิทยาศาสตร์", year: "2", from: "2026-10-01", to: "2026-10-11" });
    expect(f).toEqual({ q: "641", status: "refund_due", faculty: "คณะวิทยาศาสตร์", year: "2", from: "2026-10-01", to: "2026-10-11" });
    expect(parseBuyerFilter(Object.fromEntries(new URLSearchParams(buyerQuery(f))))).toEqual(f);
  });

  it("drops anything invalid", () => {
    expect(parseBuyerFilter({ status: "expired", year: "9", from: "1/10/2026", to: ["2026-10-01", "x"] })).toEqual({
      q: "",
      status: "all",
      faculty: "",
      year: "",
      from: "",
      to: "2026-10-01",
    });
  });

  it("omits defaults from the query string", () => {
    expect(buyerQuery({ q: "", status: "all", year: "1" })).toBe("year=1");
  });
});

describe("safeBack", () => {
  it("only follows dashboard paths", () => {
    expect(safeBack("/dashboard/buyers?status=paid", "/f")).toBe("/dashboard/buyers?status=paid");
    for (const bad of ["https://evil.com", "//evil.com", "/dashboardx", "/me", undefined, ["/dashboard/buyers"]]) {
      expect(safeBack(bad, "/f")).toBe("/f");
    }
  });
});

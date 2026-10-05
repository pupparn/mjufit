import { describe, expect, it } from "vitest";
import { addDays, dailySales, entryHeatmap, salesTotals, slipStats, tally, toCsv, weekStart } from "./stats";

describe("dates", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("finds Monday", () => {
    expect(weekStart("2026-10-05")).toBe("2026-10-05"); // Monday
    expect(weekStart("2026-10-11")).toBe("2026-10-05"); // Sunday
    expect(weekStart("2026-10-07")).toBe("2026-10-05");
  });
});

describe("sales", () => {
  const orders = [
    { businessDate: "2026-10-05", amountSatang: 2000 },
    { businessDate: "2026-10-05", amountSatang: 2000 },
    { businessDate: "2026-10-04", amountSatang: 2000 }, // Sunday, previous week
    { businessDate: "2026-09-30", amountSatang: 2000 },
  ];
  it("totals by day, week, month", () => {
    expect(salesTotals(orders, "2026-10-05")).toEqual({
      today: { count: 2, satang: 4000 },
      week: { count: 2, satang: 4000 },
      month: { count: 3, satang: 6000 },
    });
  });
  it("builds a zero-filled daily series", () => {
    const s = dailySales(orders, "2026-10-05", 3);
    expect(s.map((d) => [d.date, d.count])).toEqual([["2026-10-03", 0], ["2026-10-04", 1], ["2026-10-05", 2]]);
  });
});

describe("heatmap", () => {
  it("buckets by Bangkok weekday and hour", () => {
    // 2026-10-05 is a Monday. 01:30Z = 08:30 Bangkok.
    const g = entryHeatmap([new Date("2026-10-05T01:30:00Z"), new Date("2026-10-05T01:59:00Z")]);
    expect(g[0][8]).toBe(2);
    // 18:00Z Monday = 01:00 Tuesday Bangkok.
    expect(entryHeatmap([new Date("2026-10-05T18:00:00Z")])[1][1]).toBe(1);
  });
});

describe("slip stats", () => {
  it("tallies reasons", () => {
    expect(slipStats([{ verified: true, reason: null }, { verified: false, reason: "duplicate" }, { verified: false, reason: "duplicate" }]))
      .toEqual({ total: 3, verified: 1, failed: 2, reasons: { duplicate: 2 } });
  });
});

describe("toCsv", () => {
  it("quotes and neutralises formulas", () => {
    expect(toCsv([["a,b", 'say "hi"', "=1+1", null, -5]])).toBe('"a,b","say ""hi""",\'=1+1,,-5\r\n');
  });
});

describe("tally", () => {
  it("sorts by count then name and buckets missing values", () => {
    expect(tally(["b", "a", "b", null, ""], "?")).toEqual([["?", 2], ["b", 2], ["a", 1]]);
  });
});

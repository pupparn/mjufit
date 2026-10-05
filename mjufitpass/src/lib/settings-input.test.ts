import { describe, expect, it } from "vitest";
import { parseSettings } from "./settings-input";

const ok = { price: "20", openTime: "08:00", salesCutoff: "19:30", closeTime: "20:00", orderTtl: "15" };

describe("parseSettings", () => {
  it("converts baht to satang", () => {
    expect(parseSettings(ok)).toMatchObject({ ok: true, row: { price_satang: 2000, order_ttl_minutes: 15 } });
    expect(parseSettings({ ...ok, price: "20.5" })).toMatchObject({ ok: true, row: { price_satang: 2050 } });
  });

  it("rejects bad prices", () => {
    for (const price of ["0", "-5", "abc", "1.234", ""]) {
      expect(parseSettings({ ...ok, price })).toEqual({ ok: false, error: "invalid_price" });
    }
  });

  it("rejects bad or misordered times", () => {
    expect(parseSettings({ ...ok, openTime: "8:00" })).toEqual({ ok: false, error: "invalid_time" });
    expect(parseSettings({ ...ok, closeTime: "24:00" })).toEqual({ ok: false, error: "invalid_time" });
    expect(parseSettings({ ...ok, openTime: "19:30" })).toEqual({ ok: false, error: "order" });
    expect(parseSettings({ ...ok, salesCutoff: "20:30" })).toEqual({ ok: false, error: "order" });
    expect(parseSettings({ ...ok, salesCutoff: "20:00" })).toMatchObject({ ok: true });
  });

  it("bounds the order TTL", () => {
    for (const orderTtl of ["0", "121", "1.5", "x"]) {
      expect(parseSettings({ ...ok, orderTtl })).toEqual({ ok: false, error: "invalid_ttl" });
    }
  });
});

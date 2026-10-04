import { describe, expect, it } from "vitest";
import { formatBaht, orderExpiresAt, salesStatus, type Settings } from "./sales";
import { bangkokDate, bangkokTime } from "./time";

const settings: Settings = {
  priceSatang: 2000,
  openTime: "08:00:00",
  closeTime: "20:00:00",
  salesCutoff: "19:30:00",
  orderTtlMinutes: 15,
};

/** Bangkok wall-clock → Date (Bangkok is UTC+7, no DST). */
const bkk = (iso: string) => new Date(`${iso}+07:00`);

describe("bangkok time helpers", () => {
  it("rolls the date over at Bangkok midnight, not UTC", () => {
    const now = new Date("2026-10-04T17:30:00Z"); // 00:30 Oct 5 in Bangkok
    expect(bangkokDate(now)).toBe("2026-10-05");
    expect(bangkokTime(now)).toBe("00:30");
  });

  it("still the previous day just before Bangkok midnight", () => {
    expect(bangkokDate(new Date("2026-10-04T16:59:00Z"))).toBe("2026-10-04");
  });
});

describe("salesStatus", () => {
  it("is open before the gym opens", () => {
    expect(salesStatus(bkk("2026-10-05T06:00:00"), settings, [])).toEqual({
      open: true,
      businessDate: "2026-10-05",
    });
  });

  it("is open one minute before the cutoff", () => {
    expect(salesStatus(bkk("2026-10-05T19:29:00"), settings, []).open).toBe(true);
  });

  it("closes at the cutoff", () => {
    expect(salesStatus(bkk("2026-10-05T19:30:00"), settings, [])).toEqual({
      open: false,
      businessDate: "2026-10-05",
      reason: "after_cutoff",
    });
  });

  it("is closed all day on a closed date", () => {
    expect(salesStatus(bkk("2026-10-05T09:00:00"), settings, ["2026-10-05"])).toMatchObject({
      open: false,
      reason: "closed_day",
    });
  });

  it("reopens after midnight", () => {
    expect(salesStatus(bkk("2026-10-06T00:01:00"), settings, ["2026-10-05"]).open).toBe(true);
  });
});

describe("orderExpiresAt", () => {
  it("adds the TTL", () => {
    const now = new Date("2026-10-05T03:00:00Z");
    expect(orderExpiresAt(now, settings).toISOString()).toBe("2026-10-05T03:15:00.000Z");
  });
});

describe("formatBaht", () => {
  it("formats satang", () => {
    expect(formatBaht(2000)).toBe("20.00");
    expect(formatBaht(2550)).toBe("25.50");
  });
});

export type SettingsInput = {
  price: string; // baht, e.g. "20" or "20.50"
  openTime: string; // "HH:MM"
  salesCutoff: string;
  closeTime: string;
  orderTtl: string; // minutes
};

export type SettingsRow = {
  price_satang: number;
  open_time: string;
  sales_cutoff: string;
  close_time: string;
  order_ttl_minutes: number;
};

export type SettingsError = "invalid_price" | "invalid_time" | "order" | "invalid_ttl";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Validates the settings form; mirrors the CHECK constraints in the settings table. */
export function parseSettings(input: SettingsInput): { ok: true; row: SettingsRow } | { ok: false; error: SettingsError } {
  const price = input.price.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(price)) return { ok: false, error: "invalid_price" };
  const priceSatang = Math.round(Number(price) * 100);
  if (priceSatang <= 0) return { ok: false, error: "invalid_price" };

  const [open, cutoff, close] = [input.openTime, input.salesCutoff, input.closeTime].map((t) => t.trim());
  if (![open, cutoff, close].every((t) => TIME.test(t))) return { ok: false, error: "invalid_time" };
  // "HH:MM" strings compare correctly as text.
  if (!(open < cutoff && cutoff <= close)) return { ok: false, error: "order" };

  const ttl = Number(input.orderTtl);
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > 120) return { ok: false, error: "invalid_ttl" };

  return {
    ok: true,
    row: { price_satang: priceSatang, open_time: open, sales_cutoff: cutoff, close_time: close, order_ttl_minutes: ttl },
  };
}

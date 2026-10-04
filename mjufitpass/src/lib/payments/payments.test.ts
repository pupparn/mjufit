import { describe, expect, it } from "vitest";
import { assessSlip } from "./assess";
import { createMockVerifier } from "./mock";
import { promptPayPayload } from "./promptpay";
import { validateSlipFile } from "./slip-file";
import type { SlipCheck } from "./slip-verifier";
import { mapSlip2GoResponse, promptPayAccountType, slip2GoPayload } from "./slip2go";

// Shape from https://slip2go.com/guide/rest-api/image
const slip2GoSuccess = {
  code: "200000",
  message: "Slip found.",
  data: {
    referenceId: "92887bd5-60d3-4744-9a98-b8574eaxxxxx-xx",
    transRef: "015073144041ATF00999",
    dateTime: "2026-10-05T03:15:07.123Z",
    amount: 20,
    receiver: { account: { name: "x", proxy: { type: "MSISDN", account: "081-xxx-5678" } } },
  },
};

const order = { amountSatang: 2000, businessDate: "2026-10-05" };

describe("mapSlip2GoResponse", () => {
  it.each(["200000", "200200"])("maps success code %s", (code) => {
    expect(mapSlip2GoResponse({ ...slip2GoSuccess, code })).toMatchObject({
      kind: "slip",
      transRef: "015073144041ATF00999",
      amountSatang: 2000,
      transferredAt: new Date("2026-10-05T03:15:07.123Z"),
    });
  });

  it("converts fractional baht (number or string) without float drift", () => {
    const body = (amount: unknown) => ({ ...slip2GoSuccess, data: { ...slip2GoSuccess.data, amount } });
    expect(mapSlip2GoResponse(body(20.1))).toMatchObject({ amountSatang: 2010 });
    expect(mapSlip2GoResponse(body("20.10"))).toMatchObject({ amountSatang: 2010 });
  });

  it.each([
    ["200401", "receiver_mismatch"],
    ["200402", "amount_mismatch"],
    ["200403", "wrong_date"],
    ["200404", "not_found"],
    ["200500", "fraud"],
    ["200501", "duplicate"],
  ])("maps code %s to rejected/%s", (code, reason) => {
    expect(mapSlip2GoResponse({ code, message: "x" })).toMatchObject({ kind: "rejected", reason });
  });

  it.each([
    ["400001", "no_qr"],
    ["400002", "unsupported_file"],
  ])("maps code %s to unreadable/%s", (code, reason) => {
    expect(mapSlip2GoResponse({ code, message: "x" })).toMatchObject({ kind: "unreadable", reason });
  });

  it("accepts a numeric code", () => {
    expect(mapSlip2GoResponse({ code: 200501 })).toMatchObject({ reason: "duplicate" });
  });

  it.each(["200502", "400400", "401001", "401005", "401007", "429000", "500500", "999999"])(
    "treats code %s as unavailable",
    (code) => {
      expect(mapSlip2GoResponse({ code, message: "x" }).kind).toBe("unavailable");
    },
  );

  it.each([null, "oops", 42, {}, { httpStatus: 502 }, { code: "200000", data: { transRef: "T" } }])(
    "treats malformed body %j as unavailable",
    (body) => {
      expect(mapSlip2GoResponse(body).kind).toBe("unavailable");
    },
  );
});

describe("slip2GoPayload", () => {
  it("checks duplicate, receiver and exact amount", () => {
    expect(slip2GoPayload("081-234-5678", 2000)).toEqual({
      checkDuplicate: true,
      checkReceiver: [{ accountType: "02001", accountNumber: "0812345678" }],
      checkAmount: { type: "eq", amount: "20" },
    });
  });

  it("sends satang amounts as plain baht", () => {
    expect(slip2GoPayload("0812345678", 2550).checkAmount.amount).toBe("25.5");
  });

  it.each([
    ["0812345678", "02001"],
    ["1-2345-67890-12-3", "02003"],
  ])("PromptPay %s → account type %s", (id, type) => {
    expect(promptPayAccountType(id)).toBe(type);
  });
});

describe("assessSlip", () => {
  const slip = (over: Partial<Extract<SlipCheck, { kind: "slip" }>> = {}): SlipCheck => ({
    kind: "slip",
    transRef: "T1",
    amountSatang: 2000,
    transferredAt: new Date("2026-10-05T03:00:00Z"),
    raw: null,
    ...over,
  });

  it("verifies a matching slip", () => {
    expect(assessSlip(slip(), order)).toMatchObject({ action: "record", verified: true, reason: null, transRef: "T1" });
  });

  it("flags an amount mismatch even if the provider accepted it", () => {
    expect(assessSlip(slip({ amountSatang: 1000 }), order)).toMatchObject({ verified: false, reason: "amount_mismatch" });
  });

  it("flags a slip from another Bangkok day", () => {
    // 2026-10-04T17:30Z is 00:30 on Oct 5 in Bangkok → same day, OK
    expect(assessSlip(slip({ transferredAt: new Date("2026-10-04T17:30:00Z") }), order)).toMatchObject({
      verified: true,
    });
    // 2026-10-04T16:59Z is 23:59 on Oct 4 in Bangkok → wrong day
    expect(assessSlip(slip({ transferredAt: new Date("2026-10-04T16:59:00Z") }), order)).toMatchObject({
      verified: false,
      reason: "wrong_date",
    });
  });

  it("sends provider rejections to review", () => {
    expect(assessSlip({ kind: "rejected", reason: "duplicate", raw: null }, order)).toMatchObject({
      action: "record",
      verified: false,
      reason: "duplicate",
    });
  });

  it("sends an unavailable verifier to review", () => {
    expect(assessSlip({ kind: "unavailable", raw: null }, order)).toMatchObject({ reason: "verifier_unavailable" });
  });

  it("asks to re-upload unreadable images", () => {
    expect(assessSlip({ kind: "unreadable", reason: "no_qr", raw: null }, order)).toEqual({
      action: "reupload",
      reason: "no_qr",
    });
  });
});

describe("mock verifier", () => {
  const input = { file: new Blob(["x"]), filename: "s.png", expectedAmountSatang: 2000 };
  const now = () => new Date("2026-10-05T03:00:00Z");

  it("pass produces a slip that assesses as verified", async () => {
    const check = await createMockVerifier("pass", now).verify(input);
    expect(assessSlip(check, order)).toMatchObject({ verified: true });
  });

  it("gives each passing slip a unique transRef", async () => {
    const a = await createMockVerifier("pass", now).verify(input);
    const b = await createMockVerifier("pass", now).verify(input);
    expect(a.kind === "slip" && b.kind === "slip" && a.transRef !== b.transRef).toBe(true);
  });

  it.each([
    ["fail", "amount_mismatch"],
    ["duplicate", "duplicate"],
  ] as const)("%s goes to review as %s", async (outcome, reason) => {
    const check = await createMockVerifier(outcome, now).verify(input);
    expect(assessSlip(check, order)).toMatchObject({ verified: false, reason });
  });
});

describe("validateSlipFile", () => {
  const file = (size: number, type: string) => new File([new Uint8Array(size)], "s", { type });

  it("accepts a small jpeg", () => {
    expect(validateSlipFile(file(10, "image/jpeg"))).toMatchObject({ ok: true, ext: "jpg" });
  });

  it.each([
    ["missing", null],
    ["missing", file(0, "image/png")],
    ["too_large", file(4 * 1024 * 1024 + 1, "image/png")],
    ["bad_type", file(10, "application/pdf")],
    ["bad_type", file(10, "image/webp")], // Slip2Go reads png/jpg only
  ])("rejects with %s", (error, input) => {
    expect(validateSlipFile(input)).toEqual({ ok: false, error });
  });
});

describe("promptPayPayload", () => {
  it("embeds the PromptPay ID and locked amount", () => {
    const payload = promptPayPayload("0812345678", 2000);
    expect(payload).toContain("0066812345678"); // phone in international form
    expect(payload).toContain("540520.00"); // tag 54, length 05, "20.00"
  });
});

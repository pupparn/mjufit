import type { SlipCheck, SlipVerifier } from "./slip-verifier";

// https://slip2go.com/guide/rest-api/image
// https://slip2go.com/guide/response

const SUCCESS = new Set(["200000", "200200"]); // "Slip found" / "Slip is valid"

const REJECTED: Record<string, Extract<SlipCheck, { kind: "rejected" }>["reason"]> = {
  "200401": "receiver_mismatch",
  "200402": "amount_mismatch",
  "200403": "wrong_date",
  "200404": "not_found",
  "200500": "fraud",
  "200501": "duplicate",
};

const UNREADABLE: Record<string, Extract<SlipCheck, { kind: "unreadable" }>["reason"]> = {
  "400001": "no_qr",
  "400002": "unsupported_file",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Maps a Slip2Go response body to a SlipCheck. Defensive: anything
 * unrecognised (200502 bank error, 401xxx auth/quota, 429, 5xx, malformed
 * bodies) is "unavailable" → staff review.
 */
export function mapSlip2GoResponse(body: unknown): SlipCheck {
  if (!isRecord(body)) return { kind: "unavailable", raw: body };
  const code = String(body.code ?? "");

  if (SUCCESS.has(code)) {
    const data = isRecord(body.data) ? body.data : {};
    const transRef = data.transRef;
    const amount = Number(data.amount);
    const transferredAt = new Date(String(data.dateTime));
    if (typeof transRef === "string" && Number.isFinite(amount) && !Number.isNaN(transferredAt.getTime())) {
      return { kind: "slip", transRef, amountSatang: Math.round(amount * 100), transferredAt, raw: body };
    }
    return { kind: "unavailable", raw: body };
  }

  if (code in REJECTED) return { kind: "rejected", reason: REJECTED[code], raw: body };
  if (code in UNREADABLE) return { kind: "unreadable", reason: UNREADABLE[code], raw: body };
  return { kind: "unavailable", raw: body };
}

/** PromptPay proxy type codes used by Slip2Go's checkReceiver. */
export function promptPayAccountType(promptPayId: string): "02001" | "02003" {
  return promptPayId.replace(/\D/g, "").length === 13 ? "02003" : "02001"; // national ID : phone
}

/** The `payload` JSON sent alongside the image. Date is checked by the app (Bangkok time). */
export function slip2GoPayload(promptPayId: string, expectedAmountSatang: number) {
  return {
    checkDuplicate: true,
    checkReceiver: [
      { accountType: promptPayAccountType(promptPayId), accountNumber: promptPayId.replace(/\D/g, "") },
    ],
    checkAmount: { type: "eq", amount: String(expectedAmountSatang / 100) },
  };
}

export function createSlip2GoVerifier(config: {
  apiUrl: string; // account-specific host from the Slip2Go dashboard
  secretKey: string;
  promptPayId: string;
}): SlipVerifier {
  const endpoint = `${config.apiUrl.replace(/\/+$/, "")}/api/verify-slip/qr-image/info`;

  return {
    name: "slip2go",
    async verify({ file, filename, expectedAmountSatang }) {
      const form = new FormData();
      form.append("file", file, filename);
      form.append("payload", JSON.stringify(slip2GoPayload(config.promptPayId, expectedAmountSatang)));

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${config.secretKey}` },
          body: form,
          signal: AbortSignal.timeout(15_000),
        });
        const body: unknown = await res.json().catch(() => ({ httpStatus: res.status }));
        return mapSlip2GoResponse(body);
      } catch (error) {
        return { kind: "unavailable", raw: { error: String(error) } };
      }
    },
  };
}

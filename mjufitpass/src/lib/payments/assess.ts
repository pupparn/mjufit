import { bangkokDate } from "@/lib/time";
import type { SlipCheck } from "./slip-verifier";

export type ReviewReason =
  | "duplicate"
  | "amount_mismatch"
  | "receiver_mismatch"
  | "not_found"
  | "wrong_date"
  | "fraud"
  | "verifier_unavailable";

export type SlipAssessment =
  | {
      action: "record";
      verified: boolean;
      reason: ReviewReason | null;
      transRef: string | null;
      amountSatang: number | null;
      transferredAt: Date | null;
    }
  | { action: "reupload"; reason: Extract<SlipCheck, { kind: "unreadable" }>["reason"] };

/**
 * Turns a verifier result into what happens to the order. The app re-checks
 * amount and date itself rather than trusting the provider alone.
 * trans_ref uniqueness is enforced by the database.
 */
export function assessSlip(
  check: SlipCheck,
  order: { amountSatang: number; businessDate: string },
): SlipAssessment {
  const none = { transRef: null, amountSatang: null, transferredAt: null };

  switch (check.kind) {
    case "unreadable":
      return { action: "reupload", reason: check.reason };
    case "unavailable":
      return { action: "record", verified: false, reason: "verifier_unavailable", ...none };
    case "rejected":
      return { action: "record", verified: false, reason: check.reason, ...none };
    case "slip": {
      const found = {
        transRef: check.transRef,
        amountSatang: check.amountSatang,
        transferredAt: check.transferredAt,
      };
      if (check.amountSatang !== order.amountSatang) {
        return { action: "record", verified: false, reason: "amount_mismatch", ...found };
      }
      if (bangkokDate(check.transferredAt) !== order.businessDate) {
        return { action: "record", verified: false, reason: "wrong_date", ...found };
      }
      return { action: "record", verified: true, reason: null, ...found };
    }
  }
}

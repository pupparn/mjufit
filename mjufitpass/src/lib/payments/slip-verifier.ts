// The seam between the app and whoever reads payment slips (Slip2Go or mock).

export type SlipVerifierName = "slip2go" | "mock";

/** What a verifier learned from one slip image. */
export type SlipCheck =
  /** A readable bank slip the provider accepted. The app still checks it (see assess.ts). */
  | { kind: "slip"; transRef: string; amountSatang: number; transferredAt: Date; raw: unknown }
  /** A real slip the provider rejected → staff review. */
  | {
      kind: "rejected";
      reason: "duplicate" | "amount_mismatch" | "receiver_mismatch" | "wrong_date" | "not_found" | "fraud";
      raw: unknown;
    }
  /** Not a usable slip image → ask the student to upload again. */
  | { kind: "unreadable"; reason: "unsupported_file" | "no_qr"; raw: unknown }
  /** Provider down, quota, auth, or anything unexpected → staff review. */
  | { kind: "unavailable"; raw: unknown };

export type SlipVerifyInput = {
  file: Blob;
  filename: string;
  expectedAmountSatang: number;
};

export interface SlipVerifier {
  readonly name: SlipVerifierName;
  verify(input: SlipVerifyInput): Promise<SlipCheck>;
}

import type { SlipVerifier } from "./slip-verifier";

export const MOCK_OUTCOMES = ["pass", "fail", "duplicate"] as const;
export type MockOutcome = (typeof MOCK_OUTCOMES)[number];

export function isMockOutcome(value: unknown): value is MockOutcome {
  return MOCK_OUTCOMES.includes(value as MockOutcome);
}

/** Demo verifier: accepts any image and returns the outcome the user picked. */
export function createMockVerifier(outcome: MockOutcome, now: () => Date = () => new Date()): SlipVerifier {
  return {
    name: "mock",
    async verify({ expectedAmountSatang }) {
      const raw = { mock: true, outcome };
      switch (outcome) {
        case "pass":
          return {
            kind: "slip",
            transRef: `MOCK-${crypto.randomUUID()}`,
            amountSatang: expectedAmountSatang,
            transferredAt: now(),
            raw,
          };
        case "fail":
          return { kind: "rejected", reason: "amount_mismatch", raw };
        case "duplicate":
          return { kind: "rejected", reason: "duplicate", raw };
      }
    },
  };
}

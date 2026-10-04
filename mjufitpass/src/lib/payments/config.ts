import "server-only";
import { createMockVerifier, isMockOutcome } from "./mock";
import type { SlipVerifier, SlipVerifierName } from "./slip-verifier";
import { createSlip2GoVerifier } from "./slip2go";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name} (see .env.example)`);
  return value;
}

/** Decided by server env only. Never falls back to mock. */
export function slipVerifierMode(): SlipVerifierName {
  const mode = process.env.SLIP_VERIFIER;
  if (mode === "slip2go" || mode === "mock") return mode;
  throw new Error(`SLIP_VERIFIER must be "slip2go" or "mock" (got ${JSON.stringify(mode)})`);
}

export function promptPayId(): string {
  return requireEnv("PROMPTPAY_ID");
}

/**
 * Builds the verifier for one submission. The client-sent mock outcome is
 * only read when the server is in mock mode.
 */
export function slipVerifierFor(formData: FormData, now: Date): SlipVerifier {
  if (slipVerifierMode() === "slip2go") {
    return createSlip2GoVerifier({
      apiUrl: requireEnv("SLIP2GO_API_URL"),
      secretKey: requireEnv("SLIP2GO_SECRET_KEY"),
      promptPayId: promptPayId(),
    });
  }
  const outcome = formData.get("mockOutcome");
  // Mock slips are "transferred" at the app clock, so they match the order day.
  return createMockVerifier(isMockOutcome(outcome) ? outcome : "pass", () => now);
}

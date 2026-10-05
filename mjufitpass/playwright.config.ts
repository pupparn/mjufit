import { defineConfig, devices } from "@playwright/test";
import { localSupabase } from "./e2e/local-supabase";

const sb = localSupabase();
const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  use: { baseURL: `http://localhost:${PORT}`, ...devices["Desktop Chrome"] },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    // Process env beats .env.local, so these override the real project's values.
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      NEXT_PUBLIC_SUPABASE_URL: sb.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: sb.publishable,
      SUPABASE_SECRET_KEY: sb.secret,
      SLIP_VERIFIER: "mock",
      PROMPTPAY_ID: "0812345678",
      DEV_IGNORE_HOURS: "1",
      E2E_TEST_LOGIN: "1",
    },
  },
});

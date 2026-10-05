import { execSync } from "node:child_process";

/** URL and keys of the local stack from `supabase start` (E2E never touches the real project). */
export function localSupabase() {
  const out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const env = Object.fromEntries(
    out
      .split("\n")
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1], m[2]]),
  );
  const url = env.API_URL;
  const publishable = env.PUBLISHABLE_KEY ?? env.ANON_KEY;
  const secret = env.SECRET_KEY ?? env.SERVICE_ROLE_KEY;
  if (!url || !publishable || !secret) throw new Error("Local Supabase not running — run `npx supabase start` first");
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) throw new Error(`Refusing non-local Supabase: ${url}`);
  return { url, publishable, secret };
}

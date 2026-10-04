-- Step 3: each ticket gets a secret for its rotating (TOTP-style) gate QR.
-- The owner reads it via the existing "tickets_select_own" policy and the
-- phone derives a new code every 30 s, offline. 2 × gen_random_uuid() gives
-- ~244 random bits without needing pgcrypto.
alter table public.tickets
  add column totp_secret text not null
    default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));

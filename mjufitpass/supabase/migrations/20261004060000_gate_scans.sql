-- Step 4: every gate scan, accepted or rejected. Written and read only with
-- the service-role key (RLS on, no policies) — it feeds the step 6 dashboard.
create table public.gate_scans (
  id          bigint generated always as identity primary key,
  ticket_id   uuid references public.tickets (id) on delete set null,
  ok          boolean not null,
  reason      text check (ok = (reason is null)),
  method      text not null check (method in ('qr', 'manual')),
  staff_email text not null,
  scanned_at  timestamptz not null
);

create index gate_scans_scanned_at_idx on public.gate_scans (scanned_at);

alter table public.gate_scans enable row level security;

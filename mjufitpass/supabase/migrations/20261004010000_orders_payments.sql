-- Step 2: settings, orders, slip submissions, tickets.
-- Business rules (sales window, slip assessment) live in TypeScript; the DB
-- holds the invariants and the one transaction that records a payment outcome.
-- Dates are Asia/Bangkok business dates computed by the app — never use
-- current_date here, since the database runs in UTC.

-- ---------------------------------------------------------------------------
-- Settings (single row) and closed dates. Editing UI arrives in step 5.
-- ---------------------------------------------------------------------------
create table public.settings (
  id                smallint primary key default 1 check (id = 1),
  price_satang      integer not null default 2000 check (price_satang > 0),
  open_time         time not null default '08:00',
  close_time        time not null default '20:00',
  sales_cutoff      time not null default '19:30',
  order_ttl_minutes integer not null default 15 check (order_ttl_minutes between 1 and 120),
  updated_at        timestamptz not null default now(),
  check (open_time < sales_cutoff and sales_cutoff <= close_time)
);

insert into public.settings default values;

create table public.closed_dates (
  date       date primary key,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.settings enable row level security;
alter table public.closed_dates enable row level security;
grant select on public.settings, public.closed_dates to authenticated;

create policy "settings_select_all" on public.settings
  for select to authenticated using (true);
create policy "closed_dates_select_all" on public.closed_dates
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create type public.order_status as enum (
  'pending_payment', -- waiting for a slip until expires_at
  'paid',            -- slip verified, ticket issued
  'needs_review',    -- slip failed a check or verifier unavailable → staff queue
  'rejected',        -- staff rejected (step 5)
  'expired'          -- no slip before expires_at
);

create table public.orders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  business_date date not null,
  amount_satang integer not null check (amount_satang > 0), -- price snapshot
  status        public.order_status not null default 'pending_payment',
  review_reason text,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- At most one live order per student per day.
create unique index orders_one_open_per_day
  on public.orders (user_id, business_date)
  where status in ('pending_payment', 'paid', 'needs_review');

alter table public.orders enable row level security;
grant select on public.orders to authenticated;
create policy "orders_select_own" on public.orders
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Slip submissions: one per order. No client access; staff views come later.
-- ---------------------------------------------------------------------------
create table public.slip_submissions (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null unique references public.orders (id) on delete cascade,
  storage_path   text not null,
  verifier       text not null check (verifier in ('slipok', 'mock')),
  verified       boolean not null,
  reason         text,
  trans_ref      text unique, -- a bank slip can pay for one order only
  amount_satang  integer,
  transferred_at timestamptz,
  raw            jsonb,
  created_at     timestamptz not null default now(),
  check (verified = (reason is null))
);

alter table public.slip_submissions enable row level security;

-- ---------------------------------------------------------------------------
-- Tickets. TOTP secret is added in step 3.
-- ---------------------------------------------------------------------------
create type public.ticket_status as enum ('active', 'cancelled');

create table public.tickets (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null unique references public.orders (id),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  business_date date not null,
  status        public.ticket_status not null default 'active',
  issued_at     timestamptz not null default now(),
  unique (user_id, business_date)
);

alter table public.tickets enable row level security;
grant select on public.tickets to authenticated;
create policy "tickets_select_own" on public.tickets
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- record_slip_result: the only way an order leaves pending_payment via a slip.
-- Records the submission and either issues the ticket or queues for review,
-- atomically. A trans_ref already used elsewhere becomes 'duplicate'.
-- Returns the order's resulting status.
-- ---------------------------------------------------------------------------
create function public.record_slip_result(
  p_order_id       uuid,
  p_storage_path   text,
  p_verifier       text,
  p_verified       boolean,
  p_reason         text,
  p_trans_ref      text,
  p_amount_satang  integer,
  p_transferred_at timestamptz,
  p_raw            jsonb
)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order    public.orders;
  v_verified boolean := p_verified;
  v_reason   text := case when p_verified then null else coalesce(p_reason, 'unknown') end;
begin
  select * into v_order from public.orders where id = p_order_id for update;

  if not found then
    raise exception 'order_not_found';
  end if;

  if v_order.status <> 'pending_payment' then
    raise exception 'order_not_pending';
  end if;

  -- Small grace period for verifier latency after the user hit submit.
  if v_order.expires_at + interval '2 minutes' < now() then
    update public.orders set status = 'expired', updated_at = now() where id = v_order.id;
    return 'expired';
  end if;

  begin
    insert into public.slip_submissions
      (order_id, storage_path, verifier, verified, reason, trans_ref, amount_satang, transferred_at, raw)
    values
      (v_order.id, p_storage_path, p_verifier, v_verified, v_reason, p_trans_ref, p_amount_satang, p_transferred_at, p_raw);
  exception when unique_violation then
    -- trans_ref already used by another order.
    v_verified := false;
    v_reason := 'duplicate';
    insert into public.slip_submissions
      (order_id, storage_path, verifier, verified, reason, trans_ref, amount_satang, transferred_at, raw)
    values
      (v_order.id, p_storage_path, p_verifier, false, v_reason, null, p_amount_satang, p_transferred_at,
       jsonb_build_object('duplicate_trans_ref', p_trans_ref, 'raw', p_raw));
  end;

  if v_verified then
    update public.orders set status = 'paid', updated_at = now() where id = v_order.id;
    insert into public.tickets (order_id, user_id, business_date)
    values (v_order.id, v_order.user_id, v_order.business_date);
    return 'paid';
  end if;

  update public.orders
  set status = 'needs_review', review_reason = v_reason, updated_at = now()
  where id = v_order.id;
  return 'needs_review';
end;
$$;

revoke execute on function public.record_slip_result(uuid, text, text, boolean, text, text, integer, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_slip_result(uuid, text, text, boolean, text, text, integer, timestamptz, jsonb)
  to service_role;

-- Realtime updates for the order status page (publication exists on Supabase).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;

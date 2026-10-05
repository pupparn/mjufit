-- Step 5: staff review of flagged slips, ticket cancellation, refund tracking,
-- and an audit log of every staff action. All writes are service-role only.

alter table public.orders
  add column refund_required boolean not null default false,
  add column refunded_at timestamptz;

-- Audit log. Reads/writes only with the service-role key (RLS on, no policies).
create table public.staff_actions (
  id          bigint generated always as identity primary key,
  staff_email text not null,
  action      text not null check (action in (
    'approve_order', 'reject_order', 'cancel_ticket', 'mark_refunded',
    'add_staff', 'remove_staff', 'update_settings', 'add_closed_date', 'remove_closed_date'
  )),
  order_id    uuid references public.orders (id) on delete set null,
  note        text,
  created_at  timestamptz not null default now()
);

create index staff_actions_order_idx on public.staff_actions (order_id);
alter table public.staff_actions enable row level security;

-- Approve or reject a needs_review order, atomically with its audit row.
-- p_refund: staff say money was received but the student gets no pass
-- (reject), or the pass is already unusable (approve after closing).
create function public.staff_review_order(
  p_order_id    uuid,
  p_approve     boolean,
  p_refund      boolean,
  p_note        text,
  p_staff_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if btrim(coalesce(p_note, '')) = '' then
    raise exception 'note_required';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.status <> 'needs_review' then raise exception 'order_not_reviewable'; end if;

  if p_approve then
    update public.orders
    set status = 'paid', refund_required = p_refund, updated_at = now()
    where id = v_order.id;
    insert into public.tickets (order_id, user_id, business_date)
    values (v_order.id, v_order.user_id, v_order.business_date);
  else
    update public.orders
    set status = 'rejected', refund_required = p_refund, updated_at = now()
    where id = v_order.id;
  end if;

  insert into public.staff_actions (staff_email, action, order_id, note)
  values (p_staff_email, case when p_approve then 'approve_order' else 'reject_order' end, v_order.id, btrim(p_note));
end;
$$;

-- Cancel a paid order's ticket. p_refund flags it for a manual refund.
create function public.staff_cancel_ticket(
  p_order_id    uuid,
  p_refund      boolean,
  p_note        text,
  p_staff_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.tickets;
begin
  if btrim(coalesce(p_note, '')) = '' then
    raise exception 'note_required';
  end if;

  select * into v_ticket from public.tickets where order_id = p_order_id for update;
  if not found then raise exception 'ticket_not_found'; end if;
  if v_ticket.status <> 'active' then raise exception 'ticket_not_active'; end if;

  update public.tickets set status = 'cancelled' where id = v_ticket.id;
  update public.orders
  set refund_required = p_refund, updated_at = now()
  where id = p_order_id;

  insert into public.staff_actions (staff_email, action, order_id, note)
  values (p_staff_email, 'cancel_ticket', p_order_id, btrim(p_note));
end;
$$;

-- Record that a flagged refund was paid back outside the system.
create function public.staff_mark_refunded(
  p_order_id    uuid,
  p_note        text,
  p_staff_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if btrim(coalesce(p_note, '')) = '' then
    raise exception 'note_required';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if not v_order.refund_required or v_order.refunded_at is not null then
    raise exception 'no_refund_due';
  end if;

  update public.orders set refunded_at = now(), updated_at = now() where id = v_order.id;

  insert into public.staff_actions (staff_email, action, order_id, note)
  values (p_staff_email, 'mark_refunded', v_order.id, btrim(p_note));
end;
$$;

revoke execute on function public.staff_review_order(uuid, boolean, boolean, text, text) from public, anon, authenticated;
revoke execute on function public.staff_cancel_ticket(uuid, boolean, text, text) from public, anon, authenticated;
revoke execute on function public.staff_mark_refunded(uuid, text, text) from public, anon, authenticated;
grant execute on function public.staff_review_order(uuid, boolean, boolean, text, text) to service_role;
grant execute on function public.staff_cancel_ticket(uuid, boolean, text, text) to service_role;
grant execute on function public.staff_mark_refunded(uuid, text, text) to service_role;

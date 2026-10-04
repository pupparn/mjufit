-- record_slip_result takes the app's "now" for the expiry check, so expiry
-- follows the same clock as the rest of the business rules (including the
-- dev clock override). Only the server (service_role) can call it.

drop function public.record_slip_result(uuid, text, text, boolean, text, text, integer, timestamptz, jsonb);

create function public.record_slip_result(
  p_order_id       uuid,
  p_storage_path   text,
  p_verifier       text,
  p_verified       boolean,
  p_reason         text,
  p_trans_ref      text,
  p_amount_satang  integer,
  p_transferred_at timestamptz,
  p_raw            jsonb,
  p_now            timestamptz
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
  if v_order.expires_at + interval '2 minutes' < p_now then
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

revoke execute on function public.record_slip_result(uuid, text, text, boolean, text, text, integer, timestamptz, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_slip_result(uuid, text, text, boolean, text, text, integer, timestamptz, jsonb, timestamptz)
  to service_role;

-- Participants must not PATCH payment fields (status, amount, Stripe IDs).
-- Service role / SECURITY DEFINER still write those after Stripe verification.
-- Workers may still upload before/after photo paths on their own gig orders.

revoke update on table public.orders from anon, authenticated, public;
revoke insert on table public.orders from anon, authenticated, public;

grant update (before_photo_url, after_photo_url)
  on table public.orders to authenticated;

revoke update on table public.marketplace_orders from anon, authenticated, public;
revoke insert on table public.marketplace_orders from anon, authenticated, public;

create or replace function public.mark_own_order_complete(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result public.orders;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.orders
  set
    status = 'completed',
    worker_marked_complete_at = now()
  where id = p_order_id
    and worker_id = uid
    and status = 'escrowed'
    and stripe_payment_intent_id is not null
    and worker_marked_complete_at is null
  returning * into result;

  if result.id is null then
    raise exception 'Order cannot be marked complete';
  end if;

  return result;
end;
$$;

revoke all on function public.mark_own_order_complete(uuid) from public, anon;
grant execute on function public.mark_own_order_complete(uuid) to authenticated;

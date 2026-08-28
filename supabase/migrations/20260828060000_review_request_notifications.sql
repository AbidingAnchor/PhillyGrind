-- Prompt both transaction parties to leave a review once an order completes.
-- Fires once per party per order (status transition into completed).

alter table public.notifications
  add column if not exists order_id uuid;

create or replace function public.profile_display_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(name), ''), 'your neighbor')
  from public.profiles
  where id = p_user_id;
$$;

create or replace function public.notify_parties_on_gig_order_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  worker_name text;
  hirer_name text;
begin
  if new.status = 'completed'
    and old.status is distinct from 'completed'
    and new.hirer_id <> new.worker_id then

    worker_name := public.profile_display_name(new.worker_id);
    hirer_name := public.profile_display_name(new.hirer_id);

    if public.user_wants_notifications(new.hirer_id)
      and not exists (
        select 1
        from public.notifications n
        where n.user_id = new.hirer_id
          and n.order_id = new.id
          and n.type = 'review_request'
      ) then
      insert into public.notifications (user_id, type, message, listing_id, listing_type, order_id)
      values (
        new.hirer_id,
        'review_request',
        format('How was working with %s? Leave a review.', worker_name),
        new.listing_id,
        'gig',
        new.id
      );
    end if;

    if public.user_wants_notifications(new.worker_id)
      and not exists (
        select 1
        from public.notifications n
        where n.user_id = new.worker_id
          and n.order_id = new.id
          and n.type = 'review_request'
      ) then
      insert into public.notifications (user_id, type, message, listing_id, listing_type, order_id)
      values (
        new.worker_id,
        'review_request',
        format('How was working with %s? Leave a review.', hirer_name),
        new.listing_id,
        'gig',
        new.id
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_gig_order_completed_review_request on public.orders;
create trigger on_gig_order_completed_review_request
  after update on public.orders
  for each row execute function public.notify_parties_on_gig_order_completed();

create or replace function public.notify_parties_on_marketplace_order_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  buyer_name text;
  seller_name text;
begin
  if new.status = 'completed'
    and old.status is distinct from 'completed'
    and new.buyer_id <> new.seller_id then

    buyer_name := public.profile_display_name(new.buyer_id);
    seller_name := public.profile_display_name(new.seller_id);

    if public.user_wants_notifications(new.buyer_id)
      and not exists (
        select 1
        from public.notifications n
        where n.user_id = new.buyer_id
          and n.order_id = new.id
          and n.type = 'review_request'
      ) then
      insert into public.notifications (user_id, type, message, listing_id, listing_type, order_id)
      values (
        new.buyer_id,
        'review_request',
        format('How was your purchase from %s? Leave a review.', seller_name),
        new.listing_id,
        'marketplace',
        new.id
      );
    end if;

    if public.user_wants_notifications(new.seller_id)
      and not exists (
        select 1
        from public.notifications n
        where n.user_id = new.seller_id
          and n.order_id = new.id
          and n.type = 'review_request'
      ) then
      insert into public.notifications (user_id, type, message, listing_id, listing_type, order_id)
      values (
        new.seller_id,
        'review_request',
        format('How was selling to %s? Leave a review.', buyer_name),
        new.listing_id,
        'marketplace',
        new.id
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_marketplace_order_completed_review_request on public.marketplace_orders;
create trigger on_marketplace_order_completed_review_request
  after update on public.marketplace_orders
  for each row execute function public.notify_parties_on_marketplace_order_completed();

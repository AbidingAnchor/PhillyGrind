-- Gate new reviews to completed gig/marketplace orders.
-- Existing rows (order_id null) are unchanged.

alter table public.reviews
  add column if not exists order_id uuid,
  add column if not exists listing_type text;

alter table public.reviews
  drop constraint if exists reviews_listing_type_check;

alter table public.reviews
  add constraint reviews_listing_type_check
  check (listing_type is null or listing_type in ('job', 'gig', 'marketplace'));

alter table public.reviews
  drop constraint if exists reviews_listing_id_reviewer_id_key;

create unique index if not exists reviews_order_id_reviewer_id_idx
  on public.reviews (order_id, reviewer_id)
  where order_id is not null;

create or replace function public.can_insert_review(
  p_order_id uuid,
  p_listing_type text,
  p_listing_id uuid,
  p_reviewer_id uuid,
  p_reviewee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_order_id is null then false
    when p_reviewer_id = p_reviewee_id then false
    when p_listing_type = 'gig' then exists (
      select 1
      from public.orders o
      where o.id = p_order_id
        and o.listing_id = p_listing_id
        and o.status = 'completed'
        and (
          (o.hirer_id = p_reviewer_id and o.worker_id = p_reviewee_id)
          or (o.worker_id = p_reviewer_id and o.hirer_id = p_reviewee_id)
        )
    )
    when p_listing_type = 'marketplace' then exists (
      select 1
      from public.marketplace_orders mo
      where mo.id = p_order_id
        and mo.listing_id = p_listing_id
        and mo.status = 'completed'
        and (
          (mo.buyer_id = p_reviewer_id and mo.seller_id = p_reviewee_id)
          or (mo.seller_id = p_reviewer_id and mo.buyer_id = p_reviewee_id)
        )
    )
    else false
  end;
$$;

drop policy if exists "Users can create reviews if not suspended" on public.reviews;
drop policy if exists "Authenticated users can insert reviews" on public.reviews;

create policy "Users can create reviews if not suspended"
  on public.reviews for insert to authenticated
  with check (
    (select auth.uid()) = reviewer_id
    and reviewer_id <> reviewee_id
    and rating between 1 and 5
    and length(trim(comment)) > 0
    and not public.is_currently_suspended((select auth.uid()))
    and not public.users_are_blocked(reviewer_id, reviewee_id)
    and order_id is not null
    and listing_type in ('gig', 'marketplace')
    and public.can_insert_review(
      order_id,
      listing_type,
      listing_id,
      reviewer_id,
      reviewee_id
    )
  );

create or replace function public.notify_reviewee_on_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_listing_type text;
begin
  resolved_listing_type := new.listing_type;

  if resolved_listing_type is null then
    if exists (select 1 from public.jobs where id = new.listing_id) then
      resolved_listing_type := 'job';
    elsif exists (select 1 from public.gigs where id = new.listing_id) then
      resolved_listing_type := 'gig';
    elsif exists (select 1 from public.marketplace_listings where id = new.listing_id) then
      resolved_listing_type := 'marketplace';
    end if;
  end if;

  if new.reviewee_id <> new.reviewer_id
    and public.user_wants_notifications(new.reviewee_id) then
    insert into public.notifications (user_id, type, message, listing_id, listing_type)
    values (
      new.reviewee_id,
      'review',
      'Someone left you a new review.',
      new.listing_id,
      resolved_listing_type
    );
  end if;

  return new;
end;
$$;

alter table public.notifications
  drop constraint if exists notifications_listing_type_check;

alter table public.notifications
  add constraint notifications_listing_type_check
  check (listing_type is null or listing_type in ('job', 'gig', 'marketplace'));

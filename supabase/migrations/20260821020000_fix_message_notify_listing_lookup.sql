-- Profile DMs use a placeholder listing_id and are not tied to a job/gig/marketplace row.
-- The previous trigger queried public.marketplace_items (which does not exist), so those
-- inserts failed with a raw Postgres error.

create or replace function public.notify_listing_poster_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_owner uuid;
  listing_title text;
  listing_kind text;
  profile_conversation_listing_id constant uuid := '00000000-0000-0000-0000-000000000001';
begin
  if new.listing_id is null or new.listing_id = profile_conversation_listing_id then
    return new;
  end if;

  select user_id, title
  into listing_owner, listing_title
  from public.jobs
  where id = new.listing_id;

  if listing_owner is not null then
    listing_kind := 'job';
  end if;

  if listing_owner is null then
    select user_id, title
    into listing_owner, listing_title
    from public.gigs
    where id = new.listing_id;

    if listing_owner is not null then
      listing_kind := 'gig';
    end if;
  end if;

  if listing_owner is null then
    select user_id, title
    into listing_owner, listing_title
    from public.marketplace_listings
    where id = new.listing_id;

    if listing_owner is not null then
      listing_kind := 'marketplace';
    end if;
  end if;

  if listing_owner is not null
    and listing_owner <> new.sender_id
    and public.user_wants_notifications(listing_owner) then
    insert into public.notifications (user_id, type, message, listing_id, listing_type, sender_id)
    values (
      listing_owner,
      'message',
      'Someone messaged you about "' || coalesce(listing_title, 'your listing') || '".',
      new.listing_id,
      listing_kind,
      new.sender_id
    );
  end if;

  return new;
end;
$$;

-- Notifications preference: default true so existing users keep current behavior.
alter table public.profiles
  add column if not exists notifications_enabled boolean not null default true;

-- Shared gate used by all notification trigger functions.
create or replace function public.user_wants_notifications(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select notifications_enabled from public.profiles where id = target_user_id),
    true
  );
$$;

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
begin
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
    from public.marketplace_items
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

create or replace function public.notify_reviewee_on_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_type text;
begin
  if exists (select 1 from public.jobs where id = new.listing_id) then
    listing_type := 'job';
  elsif exists (select 1 from public.gigs where id = new.listing_id) then
    listing_type := 'gig';
  end if;

  if new.reviewee_id <> new.reviewer_id
    and public.user_wants_notifications(new.reviewee_id) then
    insert into public.notifications (user_id, type, message, listing_id, listing_type)
    values (
      new.reviewee_id,
      'review',
      'Someone left you a new review.',
      new.listing_id,
      listing_type
    );
  end if;

  return new;
end;
$$;

create or replace function public.notify_hirer_on_worker_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed'
    and new.worker_marked_complete_at is not null
    and old.worker_marked_complete_at is null
    and new.hirer_id <> new.worker_id
    and public.user_wants_notifications(new.hirer_id) then
    insert into public.notifications (user_id, type, message, listing_id)
    values (
      new.hirer_id,
      'payment',
      'A worker marked your PhillyGrind order complete. Confirm it to release payment.',
      new.listing_id
    );
  end if;

  return new;
end;
$$;

create or replace function public.notify_on_comment_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author uuid;
  parent_comment_author uuid;
  post_content text;
begin
  select user_id, content
  into post_author, post_content
  from public.community_posts
  where id = new.post_id;

  if post_author is not null
    and post_author <> new.user_id
    and public.user_wants_notifications(post_author) then
    insert into public.notifications (user_id, type, message, post_id, sender_id)
    values (
      post_author,
      'comment',
      'Someone commented on your post "' || coalesce(substring(post_content, 1, 50), 'post') || '..."',
      new.post_id,
      new.user_id
    );
  end if;

  if new.parent_comment_id is not null then
    select user_id
    into parent_comment_author
    from public.community_comments
    where id = new.parent_comment_id;

    if parent_comment_author is not null
      and parent_comment_author <> new.user_id
      and parent_comment_author <> post_author
      and public.user_wants_notifications(parent_comment_author) then
      insert into public.notifications (user_id, type, message, post_id, sender_id)
      values (
        parent_comment_author,
        'comment_reply',
        'Someone replied to your comment on a post',
        new.post_id,
        new.user_id
      );
    end if;
  end if;

  return new;
end;
$$;

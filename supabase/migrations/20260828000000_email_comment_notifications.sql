-- Email preference for Community post comments. Default true so existing
-- users receive emails until they opt out in Settings. Independent of
-- notifications_enabled (in-app bell).

alter table public.profiles
  add column if not exists email_comment_notifications boolean not null default true;

grant update (email_comment_notifications) on table public.profiles to authenticated;

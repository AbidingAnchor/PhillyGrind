-- Marketing email opt-out. Default false so existing users stay subscribed
-- until they click Unsubscribe. Independent of notifications_enabled (in-app)
-- and email_comment_notifications.

alter table public.profiles
  add column if not exists unsubscribed boolean not null default false;

grant update (unsubscribed) on table public.profiles to authenticated;

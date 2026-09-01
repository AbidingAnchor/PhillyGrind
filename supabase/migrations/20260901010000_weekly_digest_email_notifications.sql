-- Add weekly digest email notification preference to profiles (opt-in, default false)
alter table public.profiles
add column if not exists weekly_digest_email_notifications boolean default false;

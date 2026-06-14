-- Admin dashboard, content moderation, reports, and user suspension

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and lower(email) = 'drewnegron95@gmail.com'
  );
$$;

-- Moderation columns on listing tables
alter table public.jobs
  add column if not exists moderation_status text not null default 'approved'
    check (moderation_status in ('approved', 'flagged', 'removed', 'rejected')),
  add column if not exists moderation_scores jsonb;

alter table public.gigs
  add column if not exists moderation_status text not null default 'approved'
    check (moderation_status in ('approved', 'flagged', 'removed', 'rejected')),
  add column if not exists moderation_scores jsonb;

alter table public.marketplace_listings
  add column if not exists moderation_status text not null default 'approved'
    check (moderation_status in ('approved', 'flagged', 'removed', 'rejected')),
  add column if not exists moderation_scores jsonb;

-- ---------------------------------------------------------------------------
-- reports table
-- ---------------------------------------------------------------------------

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  reported_type text not null check (reported_type in ('listing', 'user')),
  reported_id uuid not null,
  listing_type text check (listing_type is null or listing_type in ('job', 'gig', 'marketplace')),
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'dismissed', 'warned', 'removed')),
  source text not null default 'user' check (source in ('user', 'moderation')),
  moderation_scores jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index if not exists reports_status_idx on public.reports (status) where status = 'pending';
create index if not exists reports_reported_idx on public.reports (reported_type, reported_id);

alter table public.reports enable row level security;

drop policy if exists "Admin can manage reports" on public.reports;
create policy "Admin can manage reports"
  on public.reports for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Users can submit reports" on public.reports;
create policy "Users can submit reports"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "Users can view own reports" on public.reports;
create policy "Users can view own reports"
  on public.reports for select
  using (auth.uid() = reporter_id);

-- ---------------------------------------------------------------------------
-- suspended_users table
-- ---------------------------------------------------------------------------

create table if not exists public.suspended_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (action_type in ('suspended', 'banned')),
  reason text not null,
  suspended_at timestamptz not null default now(),
  suspended_by uuid references auth.users(id) on delete set null,
  lifted_at timestamptz,
  unique (user_id, action_type)
);

create index if not exists suspended_users_active_idx
  on public.suspended_users (user_id)
  where lifted_at is null;

alter table public.suspended_users enable row level security;

drop policy if exists "Admin can manage suspensions" on public.suspended_users;
create policy "Admin can manage suspensions"
  on public.suspended_users for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Users can view own suspension status" on public.suspended_users;
create policy "Users can view own suspension status"
  on public.suspended_users for select
  using (auth.uid() = user_id);

-- Admin listing management policies
drop policy if exists "Admin can view all jobs" on public.jobs;
create policy "Admin can view all jobs"
  on public.jobs for select
  using (public.is_admin());

drop policy if exists "Admin can update all jobs" on public.jobs;
create policy "Admin can update all jobs"
  on public.jobs for update
  using (public.is_admin());

drop policy if exists "Admin can delete all jobs" on public.jobs;
create policy "Admin can delete all jobs"
  on public.jobs for delete
  using (public.is_admin());

drop policy if exists "Admin can view all gigs" on public.gigs;
create policy "Admin can view all gigs"
  on public.gigs for select
  using (public.is_admin());

drop policy if exists "Admin can update all gigs" on public.gigs;
create policy "Admin can update all gigs"
  on public.gigs for update
  using (public.is_admin());

drop policy if exists "Admin can delete all gigs" on public.gigs;
create policy "Admin can delete all gigs"
  on public.gigs for delete
  using (public.is_admin());

drop policy if exists "Admin can view all marketplace listings" on public.marketplace_listings;
create policy "Admin can view all marketplace listings"
  on public.marketplace_listings for select
  using (public.is_admin());

drop policy if exists "Admin can update all marketplace listings" on public.marketplace_listings;
create policy "Admin can update all marketplace listings"
  on public.marketplace_listings for update
  using (public.is_admin());

drop policy if exists "Admin can delete all marketplace listings" on public.marketplace_listings;
create policy "Admin can delete all marketplace listings"
  on public.marketplace_listings for delete
  using (public.is_admin());

-- Extend disputes status to include closed
alter table public.disputes drop constraint if exists disputes_status_check;
alter table public.disputes
  add constraint disputes_status_check check (status in ('open', 'resolved', 'closed'));

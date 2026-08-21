-- Public jobs/gigs reads go through jobs_public / gigs_public.
-- Hide poster contact and internal moderation fields from anon/public SELECT.

drop policy if exists "Anyone can read jobs" on public.jobs;
drop policy if exists "Anyone can read gigs" on public.gigs;

drop policy if exists "Owners can read own jobs" on public.jobs;
create policy "Owners can read own jobs"
  on public.jobs for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Owners can read own gigs" on public.gigs;
create policy "Owners can read own gigs"
  on public.gigs for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke select on table public.jobs from anon;
revoke select on table public.gigs from anon;

grant select on table public.jobs to authenticated;
grant select on table public.gigs to authenticated;

create or replace view public.jobs_public
with (security_invoker = false)
as
select
  id,
  user_id,
  title,
  category,
  neighborhood,
  pay,
  company,
  description,
  created_at,
  apply_url,
  is_boosted,
  boost_tier,
  boost_expires_at,
  job_type,
  salary_min,
  salary_max
from public.jobs
where coalesce(moderation_status, 'approved') = 'approved'
  and coalesce(boost_pending, false) = false;

create or replace view public.gigs_public
with (security_invoker = false)
as
select
  id,
  user_id,
  title,
  category,
  neighborhood,
  pay,
  company,
  description,
  created_at,
  post_type,
  status,
  is_boosted,
  boost_tier,
  boost_expires_at
from public.gigs
where coalesce(moderation_status, 'approved') = 'approved'
  and coalesce(boost_pending, false) = false;

grant usage on schema public to anon, authenticated;
grant select on public.jobs_public to anon, authenticated;
grant select on public.gigs_public to anon, authenticated;

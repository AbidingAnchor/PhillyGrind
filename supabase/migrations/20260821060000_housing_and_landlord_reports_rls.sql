-- housing_listings and landlord_reports already have RLS enabled in production,
-- but policies were created only in the dashboard (not in this repo).
-- Gaps: no admin CUD on listings; landlord_reports has INSERT only (no SELECT),
-- so complaint rows are hidden from everyone except service_role. Public
-- listing SELECT currently includes address — left public until we decide
-- to split exact address vs neighborhood.

alter table public.housing_listings enable row level security;
alter table public.landlord_reports enable row level security;

-- ---------------------------------------------------------------------------
-- housing_listings
-- ---------------------------------------------------------------------------

drop policy if exists "Anyone can view active listings" on public.housing_listings;
drop policy if exists "Users can insert own listings" on public.housing_listings;
drop policy if exists "Users can update own listings" on public.housing_listings;
drop policy if exists "Users can delete own listings" on public.housing_listings;
drop policy if exists "Public can read active housing listings" on public.housing_listings;
drop policy if exists "Owners can read own housing listings" on public.housing_listings;
drop policy if exists "Admins can read all housing listings" on public.housing_listings;
drop policy if exists "Users can insert own housing listings" on public.housing_listings;
drop policy if exists "Owners can update own housing listings" on public.housing_listings;
drop policy if exists "Admins can update all housing listings" on public.housing_listings;
drop policy if exists "Owners can delete own housing listings" on public.housing_listings;
drop policy if exists "Admins can delete all housing listings" on public.housing_listings;

create policy "Public can read active housing listings"
  on public.housing_listings
  for select
  to anon, authenticated
  using (status = 'active');

create policy "Owners can read own housing listings"
  on public.housing_listings
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Admins can read all housing listings"
  on public.housing_listings
  for select
  to authenticated
  using (public.is_admin());

create policy "Users can insert own housing listings"
  on public.housing_listings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Owners can update own housing listings"
  on public.housing_listings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admins can update all housing listings"
  on public.housing_listings
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Owners can delete own housing listings"
  on public.housing_listings
  for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Admins can delete all housing listings"
  on public.housing_listings
  for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- landlord_reports (complaint text must not be publicly readable)
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can report" on public.landlord_reports;
drop policy if exists "Users can insert own landlord reports" on public.landlord_reports;
drop policy if exists "Reporters can read own landlord reports" on public.landlord_reports;
drop policy if exists "Admins can read landlord reports" on public.landlord_reports;

create policy "Users can insert own landlord reports"
  on public.landlord_reports
  for insert
  to authenticated
  with check (auth.uid() = reporter_id);

create policy "Reporters can read own landlord reports"
  on public.landlord_reports
  for select
  to authenticated
  using (auth.uid() = reporter_id);

create policy "Admins can read landlord reports"
  on public.landlord_reports
  for select
  to authenticated
  using (public.is_admin());

-- Public UI shows a warning when a listing has 3+ reports. That needs a count
-- without exposing reporter_id, reason, or details.
create or replace function public.landlord_report_count(p_listing_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.landlord_reports
  where listing_id = p_listing_id;
$$;

revoke all on function public.landlord_report_count(uuid) from public, anon, authenticated;
grant execute on function public.landlord_report_count(uuid) to anon, authenticated;

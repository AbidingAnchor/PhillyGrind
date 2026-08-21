-- Public housing reads go through housing_listings_public (no street address).
-- Drop public SELECT on the base table so address cannot be pulled via PostgREST.

drop policy if exists "Public can read active housing listings" on public.housing_listings;

revoke select on table public.housing_listings from anon;

grant select on table public.housing_listings to authenticated;

create or replace view public.housing_listings_public
with (security_invoker = false)
as
select
  id,
  user_id,
  title,
  description,
  monthly_rent,
  bedrooms,
  bathrooms,
  neighborhood,
  available_date,
  pets_allowed,
  utilities_included,
  images,
  status,
  created_at
from public.housing_listings
where status = 'active';

grant usage on schema public to anon, authenticated;
grant select on public.housing_listings_public to anon, authenticated;

-- Create profiles_public view for safe public profile data access
-- This view bypasses RLS with SECURITY INVOKER = OFF to allow public queries
-- while only exposing non-sensitive columns

create or replace view profiles_public
set (security_invoker = off)
as
select id, name, bio, skills, avatar_url, banner_url, profile_tags,
       accent_color, neighborhood, neighborhoods, availability,
       identity_verified, landlord_verified, created_at
from profiles;

-- Grant public access to the view
grant usage on schema public to anon, authenticated;
grant select on profiles_public to anon, authenticated;

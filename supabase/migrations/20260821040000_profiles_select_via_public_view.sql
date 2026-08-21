-- Revert public SELECT on public.profiles. That policy exposed sensitive columns
-- (email, last_known_ip, stripe ids, resume paths, 2FA, role, etc.) to anon.
-- Public reads go through profiles_public; full rows stay own-user / admin only.

do $$
declare
  rec record;
begin
  for rec in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.profiles', rec.policyname);
  end loop;
end
$$;

revoke select on table public.profiles from anon;

grant select on table public.profiles to authenticated;

create policy "Users can read own full profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Admin can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

create or replace view public.profiles_public
with (security_invoker = false)
as
select id, name, bio, skills, avatar_url, banner_url, profile_tags,
       accent_color, neighborhood, neighborhoods, availability,
       identity_verified, landlord_verified, created_at
from public.profiles;

grant usage on schema public to anon, authenticated;
grant select on public.profiles_public to anon, authenticated;

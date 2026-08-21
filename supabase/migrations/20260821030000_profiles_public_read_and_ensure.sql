-- Profiles must be publicly readable so /profile/:id works even if the browser
-- request is missing a JWT (tracking-prevention / session-storage misses).
-- Production currently hides rows from anon, so maybeSingle() returns null.

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

grant usage on schema public to anon, authenticated;
grant select on table public.profiles to anon, authenticated;

create policy "Users can read profiles"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

-- Same insert shape as handle_new_user(), callable when a logged-in auth user
-- is missing a profiles row (trigger never ran or insert failed).
create or replace function public.ensure_own_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  auth_email text;
  auth_meta jsonb;
  result public.profiles;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select email, raw_user_meta_data
  into auth_email, auth_meta
  from auth.users
  where id = uid;

  insert into public.profiles (id, name, email, tos_agreed_at, onboarding_complete, is_adult_confirmed)
  values (
    uid,
    coalesce(auth_meta->>'name', split_part(coalesce(auth_email, ''), '@', 1), 'Neighbor'),
    coalesce(auth_email, ''),
    nullif(auth_meta->>'tos_agreed_at', '')::timestamptz,
    false,
    false
  )
  on conflict (id) do nothing;

  select * into result from public.profiles where id = uid;
  return result;
end;
$$;

revoke all on function public.ensure_own_profile() from public;
grant execute on function public.ensure_own_profile() to authenticated;

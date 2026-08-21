-- Restrict authenticated UPDATE on profiles to self-service columns.
-- RLS already limits rows to auth.uid(); without column grants a user can
-- PATCH role, Stripe IDs, verification flags, 2FA, email, and last_known_ip.
--
-- Privileged writes (Stripe, 2FA, identity, IP capture, admin) stay on
-- service_role / SECURITY DEFINER triggers. Operational fields that the
-- logged-in app still needs (onboarding, last_active, resume clear) go
-- through narrow SECURITY DEFINER RPCs below — they are not PATCH-able.

revoke update on table public.profiles from anon, authenticated, public;

grant update (
  name,
  bio,
  skills,
  avatar_url,
  banner_url,
  availability,
  neighborhood,
  neighborhoods,
  profile_tags,
  accent_color,
  notifications_enabled,
  show_available_now
) on table public.profiles to authenticated;

-- Signup insert must not be able to set role/admin/payment/security columns.
revoke insert on table public.profiles from anon, authenticated, public;

grant insert (
  id,
  name,
  email,
  tos_agreed_at,
  onboarding_complete,
  is_adult_confirmed
) on table public.profiles to authenticated;

create or replace function public.complete_own_onboarding(p_neighborhood text default null)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result public.profiles;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles
  set
    onboarding_complete = true,
    neighborhood = case
      when p_neighborhood is null or length(trim(p_neighborhood)) = 0 then neighborhood
      else trim(p_neighborhood)
    end
  where id = uid
  returning * into result;

  if result.id is null then
    raise exception 'Profile not found';
  end if;

  return result;
end;
$$;

create or replace function public.touch_own_last_active()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles
  set last_active_at = now()
  where id = uid;
end;
$$;

create or replace function public.clear_own_resume()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result public.profiles;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles
  set resume_path = null, resume_url = null
  where id = uid
  returning * into result;

  if result.id is null then
    raise exception 'Profile not found';
  end if;

  return result;
end;
$$;

revoke all on function public.complete_own_onboarding(text) from public, anon;
revoke all on function public.touch_own_last_active() from public, anon;
revoke all on function public.clear_own_resume() from public, anon;

grant execute on function public.complete_own_onboarding(text) to authenticated;
grant execute on function public.touch_own_last_active() to authenticated;
grant execute on function public.clear_own_resume() to authenticated;

do $$
declare
  extra text;
  missing_role int;
begin
  select string_agg(column_name, ', ' order by column_name)
  into extra
  from information_schema.column_privileges
  where table_schema = 'public'
    and table_name = 'profiles'
    and grantee = 'authenticated'
    and privilege_type = 'UPDATE'
    and column_name not in (
      'name',
      'bio',
      'skills',
      'avatar_url',
      'banner_url',
      'availability',
      'neighborhood',
      'neighborhoods',
      'profile_tags',
      'accent_color',
      'notifications_enabled',
      'show_available_now'
    );

  if extra is not null then
    raise exception 'authenticated UPDATE on profiles is too broad: %', extra;
  end if;

  select count(*)
  into missing_role
  from information_schema.column_privileges
  where table_schema = 'public'
    and table_name = 'profiles'
    and grantee = 'authenticated'
    and privilege_type = 'UPDATE'
    and column_name = 'role';

  if missing_role > 0 then
    raise exception 'authenticated still has UPDATE on profiles.role';
  end if;
end;
$$;

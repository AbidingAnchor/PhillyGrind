-- Invite a neighbor: record who referred a new account.
-- referred_by is not client-writable (not in UPDATE grants).
-- Claim happens via SECURITY DEFINER RPC. Invite count is public
-- on profiles_public without exposing who was referred.

alter table public.profiles
  add column if not exists referred_by uuid references public.profiles(id) on delete set null;

create index if not exists profiles_referred_by_idx
  on public.profiles (referred_by);

create or replace function public.claim_own_referral(p_referrer_id uuid)
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

  if p_referrer_id is null or p_referrer_id = uid then
    raise exception 'Invalid referrer';
  end if;

  if not exists (select 1 from public.profiles where id = p_referrer_id) then
    raise exception 'Referrer not found';
  end if;

  update public.profiles
  set referred_by = p_referrer_id
  where id = uid
    and referred_by is null
  returning * into result;

  if result.id is null then
    select * into result from public.profiles where id = uid;
  end if;

  if result.id is null then
    raise exception 'Profile not found';
  end if;

  return result;
end;
$$;

revoke all on function public.claim_own_referral(uuid) from public, anon;
grant execute on function public.claim_own_referral(uuid) to authenticated;

create or replace view public.profiles_public
with (security_invoker = false)
as
select
  id,
  name,
  bio,
  skills,
  avatar_url,
  banner_url,
  profile_tags,
  accent_color,
  neighborhood,
  neighborhoods,
  availability,
  identity_verified,
  landlord_verified,
  created_at,
  (
    select count(*)::int
    from public.profiles referred
    where referred.referred_by = profiles.id
  ) as neighbors_invited
from public.profiles;

grant select on public.profiles_public to anon, authenticated;

notify pgrst, 'reload schema';

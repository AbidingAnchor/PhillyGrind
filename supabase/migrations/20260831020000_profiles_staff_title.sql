-- Public staff titles (Founder, Moderator, etc.). Separate from profiles.role
-- (owner/admin/user), which gates admin access. Not client-writable.

alter table public.profiles
  add column if not exists staff_title text;

alter table public.profiles
  drop constraint if exists profiles_staff_title_check;

alter table public.profiles
  add constraint profiles_staff_title_check
  check (
    staff_title is null
    or staff_title in (
      'founder',
      'cto',
      'head_moderator',
      'operations',
      'community_manager',
      'moderator'
    )
  );

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'referred_by'
  ) then
    execute $view$
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
        staff_title,
        (
          select count(*)::int
          from public.profiles referred
          where referred.referred_by = profiles.id
        ) as neighbors_invited
      from public.profiles;
    $view$;
  else
    execute $view$
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
        staff_title
      from public.profiles;
    $view$;
  end if;
end
$$;

grant select on public.profiles_public to anon, authenticated;

notify pgrst, 'reload schema';

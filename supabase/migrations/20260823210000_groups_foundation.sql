-- Phase 1: Groups foundation (schema + RLS only)
-- Does NOT change community_posts RLS or any app queries yet.
--
-- Design notes:
-- • member_count is maintained by DB triggers (not app logic) so the count stays
--   correct for joins/leaves via any future code path, direct SQL, or concurrent requests.
-- • Group creator admin membership is inserted by an AFTER INSERT trigger on groups
--   (SECURITY DEFINER) so it always happens atomically with group creation and does
--   not depend on the client remembering a second insert.

-- ---------------------------------------------------------------------------
-- Helper: is the user a group admin (creator or admin role in group_members)?
-- ---------------------------------------------------------------------------
create or replace function public.is_group_admin(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.groups g
    where g.id = p_group_id
      and g.created_by = p_user_id
  )
  or exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_user_id
      and gm.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- groups
-- ---------------------------------------------------------------------------
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text,
  neighborhood text,
  privacy text not null default 'public',
  cover_image_url text,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  member_count integer not null default 0,
  constraint groups_name_not_blank check (char_length(trim(name)) > 0),
  constraint groups_privacy_check check (privacy in ('public'))
);

create index if not exists groups_created_by_idx on public.groups (created_by);
create index if not exists groups_category_idx on public.groups (category);
create index if not exists groups_neighborhood_idx on public.groups (neighborhood);
create index if not exists groups_created_at_idx on public.groups (created_at desc);
create index if not exists groups_privacy_idx on public.groups (privacy);

-- ---------------------------------------------------------------------------
-- group_members
-- ---------------------------------------------------------------------------
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  constraint group_members_role_check check (role in ('admin', 'member')),
  constraint group_members_group_user_unique unique (group_id, user_id)
);

create index if not exists group_members_group_id_idx on public.group_members (group_id);
create index if not exists group_members_user_id_idx on public.group_members (user_id);

-- ---------------------------------------------------------------------------
-- community_posts.group_id (nullable — null = main feed, set = group feed)
-- ---------------------------------------------------------------------------
alter table public.community_posts
  add column if not exists group_id uuid references public.groups (id) on delete cascade;

create index if not exists community_posts_group_id_idx
  on public.community_posts (group_id)
  where group_id is not null;

-- ---------------------------------------------------------------------------
-- Triggers: creator → admin membership
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'admin')
  on conflict (group_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_group_created_add_creator_admin on public.groups;
create trigger on_group_created_add_creator_admin
  after insert on public.groups
  for each row
  execute function public.handle_new_group();

-- ---------------------------------------------------------------------------
-- Triggers: keep groups.member_count in sync
-- ---------------------------------------------------------------------------
create or replace function public.sync_group_member_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.groups
    set member_count = member_count + 1
    where id = new.group_id;

    return new;
  elsif tg_op = 'DELETE' then
    update public.groups
    set member_count = greatest(member_count - 1, 0)
    where id = old.group_id;

    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists on_group_member_insert_sync_count on public.group_members;
create trigger on_group_member_insert_sync_count
  after insert on public.group_members
  for each row
  execute function public.sync_group_member_count();

drop trigger if exists on_group_member_delete_sync_count on public.group_members;
create trigger on_group_member_delete_sync_count
  after delete on public.group_members
  for each row
  execute function public.sync_group_member_count();

-- ---------------------------------------------------------------------------
-- RLS: groups
-- ---------------------------------------------------------------------------
alter table public.groups enable row level security;

drop policy if exists "Authenticated can read public groups" on public.groups;
create policy "Authenticated can read public groups"
  on public.groups
  for select
  to authenticated
  using (privacy = 'public');

drop policy if exists "Authenticated can create groups" on public.groups;
create policy "Authenticated can create groups"
  on public.groups
  for insert
  to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists "Group creator or admin can update groups" on public.groups;
create policy "Group creator or admin can update groups"
  on public.groups
  for update
  to authenticated
  using (public.is_group_admin(id, (select auth.uid())))
  with check (public.is_group_admin(id, (select auth.uid())));

-- ---------------------------------------------------------------------------
-- RLS: group_members
-- ---------------------------------------------------------------------------
alter table public.group_members enable row level security;

drop policy if exists "Members can read group membership rows" on public.group_members;
create policy "Members can read group membership rows"
  on public.group_members
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.group_members mine
      where mine.group_id = group_members.group_id
        and mine.user_id = (select auth.uid())
    )
  );

drop policy if exists "Authenticated can join public groups" on public.group_members;
create policy "Authenticated can join public groups"
  on public.group_members
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'member'
    and exists (
      select 1
      from public.groups g
      where g.id = group_id
        and g.privacy = 'public'
    )
  );

drop policy if exists "Users can leave groups" on public.group_members;
create policy "Users can leave groups"
  on public.group_members
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Group admins can update member roles" on public.group_members;
create policy "Group admins can update member roles"
  on public.group_members
  for update
  to authenticated
  using (public.is_group_admin(group_id, (select auth.uid())))
  with check (public.is_group_admin(group_id, (select auth.uid())));

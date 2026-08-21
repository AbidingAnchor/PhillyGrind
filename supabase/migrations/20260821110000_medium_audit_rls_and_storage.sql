-- MEDIUM audit items: suspension checks, blocks, name_history, 2FA, storage writes.

-- 1. Suspension enforcement that does not depend on SELECT RLS on suspended_users.
--    Also honor lifted_at (live listing policies previously ignored it).
create or replace function public.is_currently_suspended(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.suspended_users
    where user_id = p_user_id
      and lifted_at is null
      and (expires_at is null or expires_at > now())
  );
$$;

revoke all on function public.is_currently_suspended(uuid) from public, anon;
grant execute on function public.is_currently_suspended(uuid) to authenticated;

-- 2. Block checks that do not depend on SELECT RLS on user_blocks.
create or replace function public.users_are_blocked(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_blocks
    where (blocker_id = p_user_a and blocked_user_id = p_user_b)
       or (blocker_id = p_user_b and blocked_user_id = p_user_a)
  );
$$;

revoke all on function public.users_are_blocked(uuid, uuid) from public, anon;
grant execute on function public.users_are_blocked(uuid, uuid) to authenticated;

-- Recreate listing/community/review policies to use is_currently_suspended().
drop policy if exists "Anyone can post jobs if not suspended" on public.jobs;
create policy "Anyone can post jobs if not suspended"
  on public.jobs for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and not public.is_currently_suspended((select auth.uid()))
  );

drop policy if exists "Owners can update jobs if not suspended" on public.jobs;
create policy "Owners can update jobs if not suspended"
  on public.jobs for update to authenticated
  using (
    (select auth.uid()) = user_id
    and not public.is_currently_suspended((select auth.uid()))
  )
  with check (
    (select auth.uid()) = user_id
    and not public.is_currently_suspended((select auth.uid()))
  );

drop policy if exists "Owners can delete jobs if not suspended" on public.jobs;
create policy "Owners can delete jobs if not suspended"
  on public.jobs for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and not public.is_currently_suspended((select auth.uid()))
  );

drop policy if exists "Anyone can post gigs if not suspended" on public.gigs;
create policy "Anyone can post gigs if not suspended"
  on public.gigs for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and not public.is_currently_suspended((select auth.uid()))
  );

drop policy if exists "Owners can update gigs if not suspended" on public.gigs;
create policy "Owners can update gigs if not suspended"
  on public.gigs for update to authenticated
  using (
    (select auth.uid()) = user_id
    and not public.is_currently_suspended((select auth.uid()))
  )
  with check (
    (select auth.uid()) = user_id
    and not public.is_currently_suspended((select auth.uid()))
  );

drop policy if exists "Owners can delete gigs if not suspended" on public.gigs;
create policy "Owners can delete gigs if not suspended"
  on public.gigs for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and not public.is_currently_suspended((select auth.uid()))
  );

drop policy if exists "Users can insert own community posts if not suspended" on public.community_posts;
create policy "Users can insert own community posts if not suspended"
  on public.community_posts for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and not public.is_currently_suspended((select auth.uid()))
  );

drop policy if exists "Users can update own community posts if not suspended" on public.community_posts;
create policy "Users can update own community posts if not suspended"
  on public.community_posts for update to authenticated
  using (
    (select auth.uid()) = user_id
    and not public.is_currently_suspended((select auth.uid()))
  )
  with check (
    (select auth.uid()) = user_id
    and not public.is_currently_suspended((select auth.uid()))
  );

drop policy if exists "Users can delete own community posts if not suspended" on public.community_posts;
create policy "Users can delete own community posts if not suspended"
  on public.community_posts for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and not public.is_currently_suspended((select auth.uid()))
  );

drop policy if exists "Users can insert own community comments if not suspended" on public.community_comments;
create policy "Users can insert own community comments if not suspended"
  on public.community_comments for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and not public.is_currently_suspended((select auth.uid()))
  );

drop policy if exists "Users can update own community comments if not suspended" on public.community_comments;
create policy "Users can update own community comments if not suspended"
  on public.community_comments for update to authenticated
  using (
    (select auth.uid()) = user_id
    and not public.is_currently_suspended((select auth.uid()))
  )
  with check (
    (select auth.uid()) = user_id
    and not public.is_currently_suspended((select auth.uid()))
  );

drop policy if exists "Users can delete own community comments if not suspended" on public.community_comments;
create policy "Users can delete own community comments if not suspended"
  on public.community_comments for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and not public.is_currently_suspended((select auth.uid()))
  );

drop policy if exists "Authenticated users can insert reviews" on public.reviews;
drop policy if exists "Users can create reviews if not suspended" on public.reviews;
create policy "Users can create reviews if not suspended"
  on public.reviews for insert to authenticated
  with check (
    (select auth.uid()) = reviewer_id
    and reviewer_id <> reviewee_id
    and rating between 1 and 5
    and length(trim(comment)) > 0
    and not public.is_currently_suspended((select auth.uid()))
  );

drop policy if exists "Users can send messages if not suspended" on public.messages;
create policy "Users can send messages if not suspended"
  on public.messages for insert to authenticated
  with check (
    (select auth.uid()) = sender_id
    and sender_id <> receiver_id
    and length(trim(content)) > 0
    and not public.users_are_blocked(sender_id, receiver_id)
    and not public.is_currently_suspended((select auth.uid()))
  );

-- 3. name_history: only insert your own row (client logs name changes on profile edit).
drop policy if exists "System can insert name history" on public.name_history;
create policy "Users can insert own name history"
  on public.name_history for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- 4. two_factor_codes: service_role only. OTP is generated in api/two-factor.js.
drop policy if exists "Users can insert own 2FA codes" on public.two_factor_codes;
drop policy if exists "Users can read own 2FA codes" on public.two_factor_codes;
drop policy if exists "Users can update own 2FA codes" on public.two_factor_codes;

revoke all on table public.two_factor_codes from anon, authenticated, public;

-- 5. Storage writes scoped like avatars/resumes.
-- community-photos client path: {userId}/{postId}/photo.ext
drop policy if exists "Authenticated can upload community photos" on storage.objects;
create policy "Authenticated can upload community photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-photos'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  );

-- dispute-photos client path: {orderId}/{kind}.ext — allow only order participants.
drop policy if exists "Dispute photo uploads by authenticated users" on storage.objects;
create policy "Dispute photo uploads by authenticated users"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'dispute-photos'
    and exists (
      select 1
      from public.marketplace_orders mo
      where mo.id::text = (storage.foldername(name))[1]
        and (mo.buyer_id = (select auth.uid()) or mo.seller_id = (select auth.uid()))
    )
  );

drop policy if exists "Dispute photo updates by uploader" on storage.objects;
create policy "Dispute photo updates by uploader"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'dispute-photos'
    and exists (
      select 1
      from public.marketplace_orders mo
      where mo.id::text = (storage.foldername(name))[1]
        and (mo.buyer_id = (select auth.uid()) or mo.seller_id = (select auth.uid()))
    )
  )
  with check (
    bucket_id = 'dispute-photos'
    and exists (
      select 1
      from public.marketplace_orders mo
      where mo.id::text = (storage.foldername(name))[1]
        and (mo.buyer_id = (select auth.uid()) or mo.seller_id = (select auth.uid()))
    )
  );

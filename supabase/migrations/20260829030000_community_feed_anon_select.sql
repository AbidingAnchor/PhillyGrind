-- Community feed is public. SELECT policies were named "Anyone can read"
-- but applied only to authenticated, so the invoker RPC returned zero rows
-- for logged-out visitors. Hidden posts stay filtered in the feed RPC/app.

drop policy if exists "Anyone can read community posts" on public.community_posts;
create policy "Anyone can read community posts"
  on public.community_posts for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can read community comments" on public.community_comments;
create policy "Anyone can read community comments"
  on public.community_comments for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can read community post likes" on public.community_post_likes;
create policy "Anyone can read community post likes"
  on public.community_post_likes for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can read community comment likes" on public.community_comment_likes;
create policy "Anyone can read community comment likes"
  on public.community_comment_likes for select
  to anon, authenticated
  using (true);

grant select on public.community_posts to anon, authenticated;
grant select on public.community_comments to anon, authenticated;
grant select on public.community_post_likes to anon, authenticated;
grant select on public.community_comment_likes to anon, authenticated;

grant execute on function public.get_community_posts_with_counts(text, uuid) to anon, authenticated;

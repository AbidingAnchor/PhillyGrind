-- ---------------------------------------------------------------------------
-- Add RPC functions for community post like/comment counts
-- ---------------------------------------------------------------------------

-- Add comment_count column if it doesn't exist
alter table community_posts
add column if not exists comment_count int default 0;

-- Function to increment community post like count
create or replace function increment_community_post_like_count(post_id uuid)
returns void as $$
begin
  update community_posts
  set like_count = like_count + 1
  where id = post_id;
end;
$$ language plpgsql security definer;

-- Function to decrement community post like count
create or replace function decrement_community_post_like_count(post_id uuid)
returns void as $$
begin
  update community_posts
  set like_count = greatest(0, like_count - 1)
  where id = post_id;
end;
$$ language plpgsql security definer;

-- Function to increment community post comment count
create or replace function increment_community_post_comment_count(post_id uuid)
returns void as $$
begin
  update community_posts
  set comment_count = comment_count + 1
  where id = post_id;
end;
$$ language plpgsql security definer;

-- Function to decrement community post comment count
create or replace function decrement_community_post_comment_count(post_id uuid)
returns void as $$
begin
  update community_posts
  set comment_count = greatest(0, comment_count - 1)
  where id = post_id;
end;
$$ language plpgsql security definer;

-- Grant execute permissions to authenticated users
grant execute on function increment_community_post_like_count to authenticated;
grant execute on function decrement_community_post_like_count to authenticated;
grant execute on function increment_community_post_comment_count to authenticated;
grant execute on function decrement_community_post_comment_count to authenticated;

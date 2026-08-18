-- Create RPC function to fetch community posts with comment counts
-- This replaces the fallback query and improves performance by calculating counts in SQL

create or replace function get_community_posts_with_counts(
  p_neighborhood text default null
)
returns table (
  id uuid,
  user_id uuid,
  content text,
  neighborhood text,
  shared_post_id uuid,
  share_count int,
  created_at timestamptz,
  photo_url text,
  comment_count bigint
)
language sql
stable
as $$
  select
    p.id,
    p.user_id,
    p.content,
    p.neighborhood,
    p.shared_post_id,
    p.share_count,
    p.created_at,
    p.photo_url,
    (select count(*) from community_comments c where c.post_id = p.id) as comment_count
  from community_posts p
  where (p_neighborhood is null or p.neighborhood = p_neighborhood)
  order by p.created_at desc;
$$;

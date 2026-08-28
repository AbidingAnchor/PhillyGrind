-- Exclude moderated-hidden posts from the main community feed RPC.

create or replace function public.get_community_posts_with_counts(
  p_neighborhood text default null,
  p_group_id uuid default null
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
  comment_count bigint,
  group_id uuid
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
    (select count(*) from public.community_comments c where c.post_id = p.id) as comment_count,
    p.group_id
  from public.community_posts p
  where coalesce(p.hidden, false) = false
    and (p_neighborhood is null or p.neighborhood = p_neighborhood)
    and (
      case
        when p_group_id is null then p.group_id is null
        else p.group_id = p_group_id
      end
    )
  order by p.created_at desc;
$$;

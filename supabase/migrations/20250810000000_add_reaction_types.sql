-- ---------------------------------------------------------------------------
-- Add reaction type support to community_post_likes
-- ---------------------------------------------------------------------------

-- Add reaction_type column to community_post_likes
alter table community_post_likes 
add column if not exists reaction_type text default 'like';

-- Add constraint for valid reaction types
alter table community_post_likes 
add constraint check_reaction_type 
check (reaction_type in ('like', 'love', 'haha', 'wow', 'sad', 'angry'));

-- Create index for reaction_type
create index if not exists community_post_likes_reaction_type_idx 
on community_post_likes(reaction_type);

-- Update existing likes to have reaction_type
update community_post_likes 
set reaction_type = 'like' 
where reaction_type is null;

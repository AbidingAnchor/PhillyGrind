-- ---------------------------------------------------------------------------
-- Community Feature - Neighborhood Social Feed
-- ---------------------------------------------------------------------------

create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  photo_url text,
  neighborhood text not null,
  like_count int default 0,
  created_at timestamptz default now()
);

create table if not exists community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references community_posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

create table if not exists community_post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references community_posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

create table if not exists community_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references community_posts(id) on delete cascade not null,
  reporter_id uuid references auth.users(id) on delete cascade not null,
  reason text not null,
  created_at timestamptz default now()
);

-- RLS Policies for community_posts
alter table community_posts enable row level security;

create policy "Anyone can read community posts"
  on community_posts for select
  to authenticated
  using (true);

create policy "Users can insert own community posts"
  on community_posts for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own community posts"
  on community_posts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own community posts"
  on community_posts for delete
  to authenticated
  using (auth.uid() = user_id);

-- RLS Policies for community_comments
alter table community_comments enable row level security;

create policy "Anyone can read community comments"
  on community_comments for select
  to authenticated
  using (true);

create policy "Users can insert own community comments"
  on community_comments for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own community comments"
  on community_comments for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own community comments"
  on community_comments for delete
  to authenticated
  using (auth.uid() = user_id);

-- RLS Policies for community_post_likes
alter table community_post_likes enable row level security;

create policy "Anyone can read community post likes"
  on community_post_likes for select
  to authenticated
  using (true);

create policy "Users can insert own community post likes"
  on community_post_likes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete own community post likes"
  on community_post_likes for delete
  to authenticated
  using (auth.uid() = user_id);

-- RLS Policies for community_reports
alter table community_reports enable row level security;

create policy "Admins can read community reports"
  on community_reports for select
  to authenticated
  using (
    exists (
      select 1
      from auth.users
      where auth.users.id = auth.uid()
        and auth.users.email = 'drewnegron95@gmail.com'
    )
  );

create policy "Users can insert own community reports"
  on community_reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

-- Indexes for community tables
create index if not exists community_posts_user_id_idx on community_posts(user_id);
create index if not exists community_posts_neighborhood_idx on community_posts(neighborhood);
create index if not exists community_posts_created_at_idx on community_posts(created_at desc);
create index if not exists community_comments_post_id_idx on community_comments(post_id);
create index if not exists community_comments_user_id_idx on community_comments(user_id);
create index if not exists community_comments_created_at_idx on community_comments(created_at desc);
create index if not exists community_post_likes_post_id_idx on community_post_likes(post_id);
create index if not exists community_post_likes_user_id_idx on community_post_likes(user_id);
create index if not exists community_reports_post_id_idx on community_reports(post_id);
create index if not exists community_reports_reporter_id_idx on community_reports(reporter_id);
create index if not exists community_reports_created_at_idx on community_reports(created_at desc);

-- community-photos storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-photos',
  'community-photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 10485760,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Public can read community photos" on storage.objects;
create policy "Public can read community photos"
  on storage.objects for select
  to public
  using (bucket_id = 'community-photos');

drop policy if exists "Authenticated can upload community photos" on storage.objects;
create policy "Authenticated can upload community photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'community-photos');

drop policy if exists "Authenticated can update own community photos" on storage.objects;
create policy "Authenticated can update own community photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'community-photos'
    and auth.uid()::text = (storage.objects.name)[1]
  )
  with check (
    bucket_id = 'community-photos'
    and auth.uid()::text = (storage.objects.name)[1]
  );

drop policy if exists "Authenticated can delete own community photos" on storage.objects;
create policy "Authenticated can delete own community photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'community-photos'
    and auth.uid()::text = (storage.objects.name)[1]
  );

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  category text not null,
  neighborhood text not null,
  pay text not null,
  company text not null,
  contact text not null,
  description text not null,
  apply_url text,
  is_boosted boolean not null default false,
  boost_tier text check (boost_tier in ('basic', 'pro')),
  boost_expires_at timestamp,
  boost_pending boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists gigs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  post_type text not null default 'seeking' check (post_type in ('offering', 'seeking')),
  status text not null default 'open' check (status in ('open', 'in progress', 'completed', 'cancelled')),
  title text not null,
  category text not null,
  neighborhood text not null,
  pay text not null,
  company text not null,
  contact text not null,
  description text not null,
  is_boosted boolean not null default false,
  boost_tier text check (boost_tier in ('basic', 'pro')),
  boost_expires_at timestamp,
  boost_pending boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  bio text,
  skills text[] not null default '{}',
  availability text,
  neighborhoods text[] not null default '{}',
  resume_path text,
  resume_url text,
  avatar_url text,
  stripe_account_id text,
  stripe_onboarding_complete boolean not null default false,
  onboarding_complete boolean not null default false,
  tos_agreed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null,
  content text not null,
  created_at timestamptz default now()
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewee_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  created_at timestamptz default now(),
  constraint reviews_no_self_review check (reviewer_id <> reviewee_id),
  unique (listing_id, reviewer_id)
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  message text not null,
  listing_id uuid,
  listing_type text check (listing_type in ('job', 'gig')),
  sender_id uuid references auth.users(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null,
  hirer_id uuid not null references auth.users(id) on delete cascade,
  worker_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'escrowed', 'completed', 'disputed', 'refunded', 'cancelled')),
  stripe_payment_intent_id text,
  created_at timestamptz default now(),
  completed_at timestamptz,
  worker_marked_complete_at timestamptz,
  released_at timestamptz,
  before_photo_url text,
  after_photo_url text
);

create table if not exists bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references gigs(id) on delete cascade,
  worker_id uuid not null references auth.users(id) on delete cascade,
  proposed_rate integer check (proposed_rate is null or proposed_rate > 0),
  pitch text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz default now(),
  unique (listing_id, worker_id)
);

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  applicant_id uuid not null references auth.users(id) on delete cascade,
  resume_url text not null,
  cover_note text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'accepted', 'rejected')),
  created_at timestamptz default now(),
  unique (job_id, applicant_id)
);

alter table jobs
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table jobs
  add column if not exists apply_url text;

alter table jobs
  add column if not exists is_boosted boolean not null default false;

alter table jobs
  add column if not exists boost_tier text;

alter table jobs
  add column if not exists boost_expires_at timestamp;

alter table jobs
  add column if not exists boost_pending boolean not null default false;

alter table gigs
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table gigs
  add column if not exists post_type text not null default 'seeking';

alter table gigs
  add column if not exists status text not null default 'open';

alter table gigs
  add column if not exists is_boosted boolean not null default false;

alter table gigs
  add column if not exists boost_tier text;

alter table gigs
  add column if not exists boost_expires_at timestamp;

alter table gigs
  add column if not exists boost_pending boolean not null default false;

alter table profiles
  add column if not exists tos_agreed_at timestamptz;

alter table profiles
  add column if not exists bio text;

alter table profiles
  add column if not exists skills text[] not null default '{}';

alter table profiles
  add column if not exists availability text;

alter table profiles
  add column if not exists neighborhoods text[] not null default '{}';

alter table profiles
  add column if not exists resume_path text;

alter table profiles
  add column if not exists resume_url text;

alter table profiles
  add column if not exists avatar_url text;

alter table profiles
  add column if not exists stripe_account_id text;

alter table profiles
  add column if not exists stripe_onboarding_complete boolean not null default false;

alter table profiles
  add column if not exists onboarding_complete boolean not null default false;

alter table notifications
  add column if not exists listing_type text;

alter table notifications
  add column if not exists sender_id uuid references auth.users(id) on delete cascade;

alter table orders
  add column if not exists worker_marked_complete_at timestamptz;

alter table orders
  add column if not exists released_at timestamptz;

alter table orders
  add column if not exists before_photo_url text;

alter table orders
  add column if not exists after_photo_url text;

alter table bids
  add column if not exists status text not null default 'pending';

alter table bids
  alter column proposed_rate drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_boost_tier_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table jobs
      add constraint jobs_boost_tier_check check (boost_tier is null or boost_tier in ('basic', 'pro'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gigs_boost_tier_check'
      and conrelid = 'public.gigs'::regclass
  ) then
    alter table gigs
      add constraint gigs_boost_tier_check check (boost_tier is null or boost_tier in ('basic', 'pro'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reviews_no_self_review'
      and conrelid = 'public.reviews'::regclass
  ) then
    alter table reviews
      add constraint reviews_no_self_review check (reviewer_id <> reviewee_id);
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'bids_proposed_rate_check'
      and conrelid = 'public.bids'::regclass
  ) then
    alter table bids drop constraint bids_proposed_rate_check;
  end if;

  alter table bids
    add constraint bids_proposed_rate_check check (proposed_rate is null or proposed_rate > 0);
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_listing_type_check'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table notifications
      add constraint notifications_listing_type_check check (listing_type in ('job', 'gig'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gigs_post_type_check'
      and conrelid = 'public.gigs'::regclass
  ) then
    alter table gigs
      add constraint gigs_post_type_check check (post_type in ('offering', 'seeking'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gigs_status_check'
      and conrelid = 'public.gigs'::regclass
  ) then
    alter table gigs
      add constraint gigs_status_check check (status in ('open', 'in progress', 'completed', 'cancelled'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bids_status_check'
      and conrelid = 'public.bids'::regclass
  ) then
    alter table bids
      add constraint bids_status_check check (status in ('pending', 'accepted', 'rejected'));
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'orders_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table orders drop constraint orders_status_check;
  end if;

  alter table orders
    add constraint orders_status_check check (status in ('pending', 'escrowed', 'completed', 'disputed', 'refunded', 'cancelled'));
end;
$$;

alter table jobs enable row level security;
alter table gigs enable row level security;
alter table profiles enable row level security;
alter table messages enable row level security;
alter table reviews enable row level security;
alter table notifications enable row level security;
alter table orders enable row level security;
alter table bids enable row level security;
alter table applications enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 5242880, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['application/pdf'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg', 'image/png'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-photos', 'job-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Anyone can read jobs" on jobs;
create policy "Anyone can read jobs"
  on jobs for select
  using (true);

drop policy if exists "Anyone can post jobs" on jobs;
create policy "Anyone can post jobs"
  on jobs for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Owners can update jobs" on jobs;
create policy "Owners can update jobs"
  on jobs for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Owners can delete jobs" on jobs;
create policy "Owners can delete jobs"
  on jobs for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Anyone can read gigs" on gigs;
create policy "Anyone can read gigs"
  on gigs for select
  using (true);

drop policy if exists "Anyone can post gigs" on gigs;
create policy "Anyone can post gigs"
  on gigs for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Owners can update gigs" on gigs;
create policy "Owners can update gigs"
  on gigs for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Owners can delete gigs" on gigs;
create policy "Owners can delete gigs"
  on gigs for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read profiles" on profiles;
create policy "Users can read profiles"
  on profiles for select
  using (true);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can insert own profile"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Thread members can read messages" on messages;
create policy "Thread members can read messages"
  on messages for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Users can send messages" on messages;
create policy "Users can send messages"
  on messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and sender_id <> receiver_id
    and length(trim(content)) > 0
  );

drop policy if exists "Anyone can read reviews" on reviews;
create policy "Anyone can read reviews"
  on reviews for select
  using (true);

drop policy if exists "Authenticated users can insert reviews" on reviews;
create policy "Authenticated users can insert reviews"
  on reviews for insert
  to authenticated
  with check (
    auth.uid() = reviewer_id
    and reviewer_id <> reviewee_id
    and rating between 1 and 5
    and length(trim(comment)) > 0
  );

drop policy if exists "Users can read own notifications" on notifications;
create policy "Users can read own notifications"
  on notifications for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can update own notifications" on notifications;
create policy "Users can update own notifications"
  on notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own notifications" on notifications;
create policy "Users can delete own notifications"
  on notifications for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Order members can read orders" on orders;
create policy "Order members can read orders"
  on orders for select
  to authenticated
  using (auth.uid() = hirer_id or auth.uid() = worker_id);

drop policy if exists "Workers can mark orders complete" on orders;
create policy "Workers can mark orders complete"
  on orders for update
  to authenticated
  using (auth.uid() = worker_id)
  with check (auth.uid() = worker_id);

drop policy if exists "Order members can update photo evidence" on orders;
drop policy if exists "Workers can update photo evidence" on orders;
create policy "Workers can update photo evidence"
  on orders for update
  to authenticated
  using (auth.uid() = worker_id)
  with check (auth.uid() = worker_id);

drop policy if exists "Bid participants can read bids" on bids;
drop policy if exists "Hirers can read bids on own listings" on bids;
create policy "Hirers can read bids on own listings"
  on bids for select
  to authenticated
  using (
    exists (
      select 1
      from gigs
      where gigs.id = bids.listing_id
        and gigs.user_id = auth.uid()
    )
  );

drop policy if exists "Workers can read own bids" on bids;
create policy "Workers can read own bids"
  on bids for select
  to authenticated
  using (auth.uid() = worker_id);

drop policy if exists "Workers can submit own bids" on bids;
create policy "Workers can submit own bids"
  on bids for insert
  to authenticated
  with check (
    auth.uid() = worker_id
  );

drop policy if exists "Listing owners can update bid status" on bids;
create policy "Listing owners can update bid status"
  on bids for update
  to authenticated
  using (
    exists (
      select 1
      from gigs
      where gigs.id = bids.listing_id
        and gigs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from gigs
      where gigs.id = bids.listing_id
        and gigs.user_id = auth.uid()
    )
  );

drop policy if exists "Applicants can read own applications" on applications;
create policy "Applicants can read own applications"
  on applications for select
  to authenticated
  using (auth.uid() = applicant_id);

drop policy if exists "Job posters can read applications for own jobs" on applications;
create policy "Job posters can read applications for own jobs"
  on applications for select
  to authenticated
  using (
    exists (
      select 1
      from jobs
      where jobs.id = applications.job_id
        and jobs.user_id = auth.uid()
    )
  );

drop policy if exists "Applicants can submit applications" on applications;
create policy "Applicants can submit applications"
  on applications for insert
  to authenticated
  with check (
    auth.uid() = applicant_id
    and exists (
      select 1
      from jobs
      where jobs.id = applications.job_id
        and jobs.user_id <> auth.uid()
    )
  );

drop policy if exists "Users can read own resumes" on storage.objects;
create policy "Users can read own resumes"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload own resumes" on storage.objects;
create policy "Users can upload own resumes"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update own resumes" on storage.objects;
create policy "Users can update own resumes"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own resumes" on storage.objects;
create policy "Users can delete own resumes"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Job posters can read applicant resumes" on storage.objects;
create policy "Job posters can read applicant resumes"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'resumes'
    and exists (
      select 1
      from applications a
      join jobs j on j.id = a.job_id
      where j.user_id = auth.uid()
        and a.resume_url = storage.objects.name
    )
  );

drop policy if exists "Anyone can read avatars" on storage.objects;
create policy "Anyone can read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload own avatars" on storage.objects;
create policy "Users can upload own avatars"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update own avatars" on storage.objects;
create policy "Users can update own avatars"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own avatars" on storage.objects;
create policy "Users can delete own avatars"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Order members can read job photos" on storage.objects;
create policy "Order members can read job photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = 'orders'
    and exists (
      select 1
      from orders
      where orders.id::text = (storage.foldername(name))[2]
        and (orders.hirer_id = auth.uid() or orders.worker_id = auth.uid())
    )
  );

drop policy if exists "Workers can upload job photos" on storage.objects;
create policy "Workers can upload job photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = 'orders'
    and exists (
      select 1
      from orders
      where orders.id::text = (storage.foldername(name))[2]
        and orders.worker_id = auth.uid()
    )
  );

drop policy if exists "Workers can update job photos" on storage.objects;
create policy "Workers can update job photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = 'orders'
    and exists (
      select 1
      from orders
      where orders.id::text = (storage.foldername(name))[2]
        and orders.worker_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = 'orders'
    and exists (
      select 1
      from orders
      where orders.id::text = (storage.foldername(name))[2]
        and orders.worker_id = auth.uid()
    )
  );

create index if not exists messages_listing_id_created_at_idx
  on messages (listing_id, created_at);

create index if not exists messages_sender_receiver_idx
  on messages (sender_id, receiver_id);

create index if not exists reviews_reviewee_id_created_at_idx
  on reviews (reviewee_id, created_at desc);

create index if not exists reviews_listing_id_idx
  on reviews (listing_id);

create index if not exists notifications_user_id_created_at_idx
  on notifications (user_id, created_at desc);

create index if not exists notifications_user_id_read_idx
  on notifications (user_id, read);

create index if not exists orders_listing_id_created_at_idx
  on orders (listing_id, created_at desc);

create index if not exists orders_hirer_worker_idx
  on orders (hirer_id, worker_id);

create index if not exists bids_listing_id_created_at_idx
  on bids (listing_id, created_at desc);

create index if not exists bids_worker_id_created_at_idx
  on bids (worker_id, created_at desc);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'messages'
    ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

drop trigger if exists on_message_notify_listing_poster on public.messages;
drop function if exists public.notify_listing_poster_on_message();

create function public.notify_listing_poster_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_owner uuid;
  listing_title text;
  listing_kind text;
begin
  select user_id, title
  into listing_owner, listing_title
  from public.jobs
  where id = new.listing_id;

  if listing_owner is not null then
    listing_kind := 'job';
  end if;

  if listing_owner is null then
    select user_id, title
    into listing_owner, listing_title
    from public.gigs
    where id = new.listing_id;

    if listing_owner is not null then
      listing_kind := 'gig';
    end if;
  end if;

  if listing_owner is not null and listing_owner <> new.sender_id then
    insert into public.notifications (user_id, type, message, listing_id, listing_type, sender_id)
    values (
      listing_owner,
      'message',
      'Someone messaged you about "' || coalesce(listing_title, 'your listing') || '".',
      new.listing_id,
      listing_kind,
      new.sender_id
    );
  end if;

  return new;
end;
$$;

create trigger on_message_notify_listing_poster
  after insert on public.messages
  for each row execute function public.notify_listing_poster_on_message();

create or replace function public.notify_reviewee_on_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_type text;
begin
  if exists (select 1 from public.jobs where id = new.listing_id) then
    listing_type := 'job';
  elsif exists (select 1 from public.gigs where id = new.listing_id) then
    listing_type := 'gig';
  end if;

  if new.reviewee_id <> new.reviewer_id then
    insert into public.notifications (user_id, type, message, listing_id, listing_type)
    values (
      new.reviewee_id,
      'review',
      'Someone left you a new review.',
      new.listing_id,
      listing_type
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_review_notify_reviewee on public.reviews;
create trigger on_review_notify_reviewee
  after insert on public.reviews
  for each row execute procedure public.notify_reviewee_on_review();

create or replace function public.notify_hirer_on_worker_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed'
    and new.worker_marked_complete_at is not null
    and old.worker_marked_complete_at is null
    and new.hirer_id <> new.worker_id then
    insert into public.notifications (user_id, type, message, listing_id)
    values (
      new.hirer_id,
      'payment',
      'A worker marked your PhillyGrind order complete. Confirm it to release payment.',
      new.listing_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_order_worker_completion_notify_hirer on public.orders;
create trigger on_order_worker_completion_notify_hirer
  after update on public.orders
  for each row execute function public.notify_hirer_on_worker_completion();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, tos_agreed_at, onboarding_complete)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    (new.raw_user_meta_data->>'tos_agreed_at')::timestamptz,
    false
  )
  on conflict (id) do update
    set name = excluded.name,
        email = excluded.email,
        tos_agreed_at = coalesce(public.profiles.tos_agreed_at, excluded.tos_agreed_at);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Marketplace
create table if not exists marketplace_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  category text not null,
  neighborhood text not null,
  price text not null,
  description text not null,
  photo_urls text[] not null default '{}',
  secure_checkout boolean not null default false,
  cash_only boolean not null default false,
  status text not null default 'active' check (status in ('active', 'sold', 'removed')),
  created_at timestamptz default now()
);

alter table marketplace_items enable row level security;

drop policy if exists "Marketplace items are viewable by everyone" on marketplace_items;
create policy "Marketplace items are viewable by everyone"
  on marketplace_items for select
  using (true);

drop policy if exists "Users can insert their own marketplace items" on marketplace_items;
create policy "Users can insert their own marketplace items"
  on marketplace_items for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own marketplace items" on marketplace_items;
create policy "Users can update their own marketplace items"
  on marketplace_items for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own marketplace items" on marketplace_items;
create policy "Users can delete their own marketplace items"
  on marketplace_items for delete
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketplace-photos', 'marketplace-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "Marketplace photos are publicly accessible" on storage.objects;
create policy "Marketplace photos are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'marketplace-photos');

drop policy if exists "Users can upload marketplace photos" on storage.objects;
create policy "Users can upload marketplace photos"
  on storage.objects for insert
  with check (bucket_id = 'marketplace-photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can update their marketplace photos" on storage.objects;
create policy "Users can update their marketplace photos"
  on storage.objects for update
  using (bucket_id = 'marketplace-photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete their marketplace photos" on storage.objects;
create policy "Users can delete their marketplace photos"
  on storage.objects for delete
  using (bucket_id = 'marketplace-photos' and auth.uid()::text = (storage.foldername(name))[1]);

alter table notifications drop constraint if exists notifications_listing_type_check;
alter table notifications
  add constraint notifications_listing_type_check check (listing_type in ('job', 'gig', 'marketplace'));

drop trigger if exists on_message_notify_listing_poster on public.messages;
drop function if exists public.notify_listing_poster_on_message();

create function public.notify_listing_poster_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_owner uuid;
  listing_title text;
  listing_kind text;
begin
  select user_id, title
  into listing_owner, listing_title
  from public.jobs
  where id = new.listing_id;

  if listing_owner is not null then
    listing_kind := 'job';
  end if;

  if listing_owner is null then
    select user_id, title
    into listing_owner, listing_title
    from public.gigs
    where id = new.listing_id;

    if listing_owner is not null then
      listing_kind := 'gig';
    end if;
  end if;

  if listing_owner is null then
    select user_id, title
    into listing_owner, listing_title
    from public.marketplace_items
    where id = new.listing_id;

    if listing_owner is not null then
      listing_kind := 'marketplace';
    end if;
  end if;

  if listing_owner is not null and listing_owner <> new.sender_id then
    insert into public.notifications (user_id, type, message, listing_id, listing_type, sender_id)
    values (
      listing_owner,
      'message',
      'Someone messaged you about "' || coalesce(listing_title, 'your listing') || '".',
      new.listing_id,
      listing_kind,
      new.sender_id
    );
  end if;

  return new;
end;
$$;

create trigger on_message_notify_listing_poster
  after insert on public.messages
  for each row execute function public.notify_listing_poster_on_message();

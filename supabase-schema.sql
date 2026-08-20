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
  neighborhood text,
  resume_path text,
  resume_url text,
  avatar_url text,
  stripe_account_id text,
  stripe_onboarding_complete boolean not null default false,
  onboarding_complete boolean not null default false,
  tos_agreed_at timestamptz,
  created_at timestamptz default now()
);

-- Add neighborhood column if it doesn't exist (for existing profiles tables)
alter table profiles add column if not exists neighborhood text;

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

alter table profiles
  add column if not exists two_factor_enabled boolean not null default false;

alter table profiles
  add column if not exists identity_verified boolean not null default false;

alter table profiles
  add column if not exists verification_status text check (verification_status in ('pending', 'verified', 'failed'));

alter table profiles
  add column if not exists stripe_identity_session_id text;

alter table profiles
  add column if not exists banner_url text;

alter table profiles
  add column if not exists profile_tags text[] not null default '{}';

alter table profiles
  add column if not exists accent_color text not null default '#22c55e';

alter table profiles
  add column if not exists is_adult_confirmed boolean not null default false;

alter table profiles
  add column if not exists show_available_now boolean not null default false;

alter table profiles
  add column if not exists last_active_at timestamptz;

alter table profiles
  add column if not exists account_reference text;

-- Create index for faster lookups by account reference
create index if not exists profiles_account_reference_idx on profiles(account_reference);

-- Name History Table for tracking display name changes
create table if not exists name_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  old_name text not null,
  new_name text not null,
  changed_at timestamptz default now()
);

-- Enable RLS for name_history
alter table name_history enable row level security;

-- Only admins can read name history
create policy "Admins can read name history"
  on name_history for select
  to authenticated
  using (
    exists (
      select 1
      from profiles
      where profiles.id = (select auth.uid())
      and profiles.email = 'drewnegron95@gmail.com'
    )
  );

-- System can insert name history (via triggers or backend)
create policy "System can insert name history"
  on name_history for insert
  to authenticated
  with check (true);

-- Index for faster lookups by user_id
create index if not exists name_history_user_id_idx on name_history(user_id);
create index if not exists name_history_changed_at_idx on name_history(changed_at desc);

-- Generate account references for existing users (PG-XXXXXXX format using first 7 chars of UUID)
do $$
begin
  update profiles
  set account_reference = 'PG-' || substring(id::text, 1, 7)
  where account_reference is null;
end $$;

-- Add role column to profiles table for staff permissions
alter table profiles
  add column if not exists role text not null default 'user' check (role in ('owner', 'admin', 'user'));

-- Create admin_action_log table for moderation logging
create table if not exists admin_action_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (action_type in ('suspend', 'ban', 'ip_ban', 'lift_suspension', 'lift_ban', 'assign_role')),
  reason text,
  metadata jsonb,
  created_at timestamptz default now()
);

-- Enable RLS for admin_action_log
alter table admin_action_log enable row level security;

-- Only admins can read action logs
create policy "Admins can read action logs"
  on admin_action_log for select
  to authenticated
  using (
    exists (
      select 1
      from profiles
      where profiles.id = (select auth.uid())
      and profiles.role in ('owner', 'admin')
    )
  );

-- Only admins can insert action logs
create policy "Admins can insert action logs"
  on admin_action_log for insert
  to authenticated
  with check (
    exists (
      select 1
      from profiles
      where profiles.id = (select auth.uid())
      and profiles.role in ('owner', 'admin')
    )
  );

-- Index for faster lookups
create index if not exists admin_action_log_admin_id_idx on admin_action_log(admin_id);
create index if not exists admin_action_log_target_user_id_idx on admin_action_log(target_user_id);
create index if not exists admin_action_log_created_at_idx on admin_action_log(created_at desc);

-- Set Drew's account to owner role
do $$
begin
  update profiles
  set role = 'owner'
  where email = 'drewnegron95@gmail.com';
end $$;

alter table notifications
  add column if not exists listing_type text;

alter table notifications
  add column if not exists sender_id uuid references auth.users(id) on delete cascade;

alter table notifications
  add column if not exists post_id uuid;

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
values ('resumes', 'resumes', false, 5242880, array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

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
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owners can update jobs" on jobs;
create policy "Owners can update jobs"
  on jobs for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owners can delete jobs" on jobs;
create policy "Owners can delete jobs"
  on jobs for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Anyone can read gigs" on gigs;
create policy "Anyone can read gigs"
  on gigs for select
  using (true);

drop policy if exists "Anyone can post gigs" on gigs;
create policy "Anyone can post gigs"
  on gigs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owners can update gigs" on gigs;
create policy "Owners can update gigs"
  on gigs for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owners can delete gigs" on gigs;
create policy "Owners can delete gigs"
  on gigs for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read profiles" on profiles;
create policy "Users can read profiles"
  on profiles for select
  using (true);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can insert own profile"
  on profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Thread members can read messages" on messages;
create policy "Thread members can read messages"
  on messages for select
  to authenticated
  using ((select auth.uid()) = sender_id or (select auth.uid()) = receiver_id);

drop policy if exists "Users can send messages" on messages;
create policy "Users can send messages"
  on messages for insert
  to authenticated
  with check (
    (select auth.uid()) = sender_id
    and sender_id <> receiver_id
    and length(trim(content)) > 0
    and not exists (
      select 1
      from messages
      where listing_id = messages.listing_id
        and sender_id = messages.sender_id
        and created_at > now() - interval '5 minutes'
    )
    and not exists (
      select 1
      from user_blocks
      where blocker_id = receiver_id
      and blocked_user_id = sender_id
    )
    and not exists (
      select 1
      from user_blocks
      where blocker_id = sender_id
      and blocked_user_id = receiver_id
    )
  );

drop policy if exists "Anyone can read reviews" on reviews;
create policy "Anyone can read reviews"
  on reviews for select
  using (true);

drop policy if exists "Users can create reviews" on reviews;
create policy "Users can create reviews"
  on reviews for insert
  to authenticated
  with check (
    (select auth.uid()) = reviewer_id
    and reviewer_id <> reviewee_id
    and rating between 1 and 5
    and length(trim(comment)) > 0
  );

drop policy if exists "Users can read own notifications" on notifications;
create policy "Users can read own notifications"
  on notifications for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can update own notifications" on notifications;
create policy "Users can update own notifications"
  on notifications for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own notifications" on notifications;
create policy "Users can delete own notifications"
  on notifications for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Order members can read orders" on orders;
create policy "Order members can read orders"
  on orders for select
  to authenticated
  using ((select auth.uid()) = hirer_id or (select auth.uid()) = worker_id);

drop policy if exists "Workers can mark orders complete" on orders;
create policy "Workers can mark orders complete"
  on orders for update
  to authenticated
  using ((select auth.uid()) = worker_id)
  with check ((select auth.uid()) = worker_id);

drop policy if exists "Order members can update photo evidence" on orders;
drop policy if exists "Workers can update photo evidence" on orders;
create policy "Workers can update photo evidence"
  on orders for update
  to authenticated
  using ((select auth.uid()) = worker_id)
  with check ((select auth.uid()) = worker_id);

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
        and gigs.user_id = (select auth.uid())
    )
  );

drop policy if exists "Workers can read own bids" on bids;
create policy "Workers can read own bids"
  on bids for select
  to authenticated
  using ((select auth.uid()) = worker_id);

drop policy if exists "Workers can submit own bids" on bids;
create policy "Workers can submit own bids"
  on bids for insert
  to authenticated
  with check (
    (select auth.uid()) = worker_id
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
        and gigs.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from gigs
      where gigs.id = bids.listing_id
        and gigs.user_id = (select auth.uid())
    )
  );

drop policy if exists "Applicants can read own applications" on applications;
create policy "Applicants can read own applications"
  on applications for select
  to authenticated
  using ((select auth.uid()) = applicant_id);

drop policy if exists "Job posters can read applications for own jobs" on applications;
create policy "Job posters can read applications for own jobs"
  on applications for select
  to authenticated
  using (
    exists (
      select 1
      from jobs
      where jobs.id = applications.job_id
        and jobs.user_id = (select auth.uid())
    )
  );

drop policy if exists "Applicants can submit own applications" on applications;
create policy "Applicants can submit own applications"
  on applications for insert
  to authenticated
  with check (
    (select auth.uid()) = applicant_id
    and exists (
      select 1
      from jobs
      where jobs.id = applications.job_id
        and jobs.user_id <> (select auth.uid())
    )
  );

drop policy if exists "Users can read own resumes" on storage.objects;
create policy "Users can read own resumes"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can upload own resumes" on storage.objects;
create policy "Users can upload own resumes"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can update own resumes" on storage.objects;
create policy "Users can update own resumes"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete own resumes" on storage.objects;
create policy "Users can delete own resumes"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
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
      where j.user_id = (select auth.uid())
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
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can update own avatars" on storage.objects;
create policy "Users can update own avatars"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete own avatars" on storage.objects;
create policy "Users can delete own avatars"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
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
      where orders.id = (storage.foldername(name))[2]::uuid
        and (orders.hirer_id = (select auth.uid()) or orders.worker_id = (select auth.uid()))
    )
  );

drop policy if exists "Workers can upload job photos" on storage.objects;
create policy "Workers can upload job photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = 'orders'
    and (storage.foldername(name))[2]::uuid in (
      select id
      from orders
      where worker_id = (select auth.uid())
    )
  );

drop policy if exists "Workers can update job photos" on storage.objects;
create policy "Workers can update job photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = 'orders'
    and (storage.foldername(name))[2]::uuid in (
      select id
      from orders
      where worker_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = 'orders'
    and (storage.foldername(name))[2]::uuid in (
      select id
      from orders
      where worker_id = (select auth.uid())
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
create table if not exists marketplace_listings (
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

-- Add neighborhood column if it doesn't exist (for existing marketplace_listings tables)
alter table marketplace_listings add column if not exists neighborhood text not null default 'Center City';

alter table marketplace_listings enable row level security;

drop policy if exists "Marketplace items are viewable by everyone" on marketplace_listings;
create policy "Marketplace items are viewable by everyone"
  on marketplace_listings for select
  using (true);

drop policy if exists "Users can insert their own marketplace items" on marketplace_listings;
create policy "Users can insert their own marketplace items"
  on marketplace_listings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own marketplace items" on marketplace_listings;
create policy "Users can update their own marketplace items"
  on marketplace_listings for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own marketplace items" on marketplace_listings;
create policy "Users can delete their own marketplace items"
  on marketplace_listings for delete
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-banners', 'profile-banners', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Profile banners are publicly accessible" on storage.objects;
create policy "Profile banners are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'profile-banners');

drop policy if exists "Users can upload own profile banners" on storage.objects;
create policy "Users can upload own profile banners"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-banners' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update their profile banners" on storage.objects;
create policy "Users can update their profile banners"
  on storage.objects for update
  using (
    bucket_id = 'profile-banners' and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'profile-banners' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete their profile banners" on storage.objects;
create policy "Users can delete their profile banners"
  on storage.objects for delete
  using (
    bucket_id = 'profile-banners' and auth.uid()::text = (storage.foldername(name))[1]
  );

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

create or replace function public.notify_on_comment_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author uuid;
  parent_comment_author uuid;
  post_content text;
begin
  -- Get post author
  select user_id, content
  into post_author, post_content
  from public.community_posts
  where id = new.post_id;

  -- Notify post author if not the commenter
  if post_author is not null and post_author <> new.user_id then
    insert into public.notifications (user_id, type, message, post_id, sender_id)
    values (
      post_author,
      'comment',
      'Someone commented on your post "' || coalesce(substring(post_content, 1, 50), 'post') || '..."',
      new.post_id,
      new.user_id
    );
  end if;

  -- If this is a reply to a comment, notify the parent comment author
  if new.parent_comment_id is not null then
    select user_id
    into parent_comment_author
    from public.community_comments
    where id = new.parent_comment_id;

    if parent_comment_author is not null and parent_comment_author <> new.user_id and parent_comment_author <> post_author then
      insert into public.notifications (user_id, type, message, post_id, sender_id)
      values (
        parent_comment_author,
        'comment_reply',
        'Someone replied to your comment on a post',
        new.post_id,
        new.user_id
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_comment_notify_reply on public.community_comments;
create trigger on_comment_notify_reply
  after insert on public.community_comments
  for each row execute function public.notify_on_comment_reply();

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
  share_count int default 0,
  shared_post_id uuid references community_posts(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references community_posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  parent_comment_id uuid references community_comments(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

create table if not exists community_comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid references community_comments(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  reaction_type text not null default 'like',
  created_at timestamptz default now(),
  unique (comment_id, user_id)
);

-- RLS Policies for community_comment_likes
alter table community_comment_likes enable row level security;

create policy "Anyone can read community comment likes"
  on community_comment_likes for select
  to authenticated
  using (true);

create policy "Users can insert own community comment likes"
  on community_comment_likes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete own community comment likes"
  on community_comment_likes for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can update own community comment likes"
  on community_comment_likes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists community_comment_likes_comment_id_idx on community_comment_likes(comment_id);
create index if not exists community_comment_likes_user_id_idx on community_comment_likes(user_id);

-- User Mutes (one-directional, per-user preference)
create table if not exists user_mutes (
  id uuid primary key default gen_random_uuid(),
  muter_id uuid references auth.users(id) on delete cascade not null,
  muted_user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (muter_id, muted_user_id),
  constraint user_mutes_no_self_mute check (muter_id <> muted_user_id)
);

-- RLS Policies for user_mutes
alter table user_mutes enable row level security;

create policy "Users can manage own mutes"
  on user_mutes for all
  to authenticated
  using (auth.uid() = muter_id)
  with check (auth.uid() = muter_id);

create index if not exists user_mutes_muter_id_idx on user_mutes(muter_id);
create index if not exists user_mutes_muted_user_id_idx on user_mutes(muted_user_id);

-- User Blocks (one-directional, restrictive)
create table if not exists user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid references auth.users(id) on delete cascade not null,
  blocked_user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (blocker_id, blocked_user_id),
  constraint user_blocks_no_self_block check (blocker_id <> blocked_user_id)
);

-- RLS Policies for user_blocks
alter table user_blocks enable row level security;

create policy "Users can manage own blocks"
  on user_blocks for all
  to authenticated
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);

create index if not exists user_blocks_blocker_id_idx on user_blocks(blocker_id);
create index if not exists user_blocks_blocked_user_id_idx on user_blocks(blocked_user_id);

create table if not exists community_post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references community_posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  reaction_type text not null default 'like',
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

-- Add reaction_type column if it doesn't exist (for existing tables)
alter table community_post_likes add column if not exists reaction_type text not null default 'like';

-- Add parent_comment_id column if it doesn't exist (for existing tables)
alter table community_comments add column if not exists parent_comment_id uuid references community_comments(id) on delete cascade;

create table if not exists community_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references community_posts(id) on delete cascade,
  comment_id uuid references community_comments(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete cascade not null,
  reason text not null,
  subreason text,
  details text,
  status text not null default 'pending' check (status in ('pending', 'dismissed', 'warned', 'removed')),
  created_at timestamptz default now(),
  constraint community_reports_either_post_or_comment check (
    (post_id is not null and comment_id is null) or 
    (post_id is null and comment_id is not null)
  )
);

-- Add comment_id column if it doesn't exist (for existing tables
alter table community_reports add column if not exists comment_id uuid references community_comments(id) on delete cascade;
alter table community_reports add column if not exists details text;
alter table community_reports add column if not exists subreason text;
alter table community_reports add column if not exists status text not null default 'pending' check (status in ('pending', 'dismissed', 'warned', 'removed'));

-- Add constraint if it doesn't exist
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'community_reports_either_post_or_comment'
      and conrelid = 'public.community_reports'::regclass
  ) then
    alter table community_reports
      add constraint community_reports_either_post_or_comment check (
        (post_id is not null and comment_id is null) or 
        (post_id is null and comment_id is not null)
      );
  end if;
end;
$$;

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

create policy "Users can update own community post likes"
  on community_post_likes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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

-- Moderation Logs Table
create table if not exists moderation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  category text not null,
  rule_name text not null,
  status text not null check (status in ('auto_rejected', 'flagged_for_review')),
  flagged_phrases text[] not null default '{}',
  explanation text,
  content_preview text,
  reviewed boolean not null default false,
  created_at timestamptz default now()
);

alter table moderation_logs enable row level security;

-- Contact Submissions Table
create table if not exists contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  category text not null check (category in ('general', 'data_deletion', 'fair_housing_complaint', 'dispute_report', 'other')),
  message text not null,
  status text not null default 'open' check (status in ('open', 'responded', 'resolved')),
  resolved_at timestamptz,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Add user_id column if it doesn't exist (for existing contact_submissions tables)
alter table contact_submissions add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table contact_submissions add column if not exists resolved_at timestamptz;

-- Update status column constraint for existing databases
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'contact_submissions_status_check'
      and conrelid = 'public.contact_submissions'::regclass
  ) then
    alter table contact_submissions drop constraint contact_submissions_status_check;
  end if;
  
  alter table contact_submissions
    add constraint contact_submissions_status_check
    check (status in ('open', 'responded', 'resolved'));
end;
$$;

-- Contact Replies Table
create table if not exists contact_replies (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contact_submissions(id) on delete cascade,
  message text not null,
  sent_at timestamptz not null default now(),
  sent_by uuid references auth.users(id)
);

alter table contact_replies enable row level security;

-- RLS Policies for contact_replies
create policy "Admins can read contact replies"
  on contact_replies for select
  to authenticated
  using (
    exists (
      select 1
      from profiles
      where profiles.id = auth.uid()
      and profiles.email = 'drewnegron95@gmail.com'
    )
  );

create policy "Admins can insert contact replies"
  on contact_replies for insert
  to authenticated
  with check (
    exists (
      select 1
      from profiles
      where profiles.id = auth.uid()
      and profiles.email = 'drewnegron95@gmail.com'
    )
  );

alter table contact_submissions enable row level security;

-- RLS Policies for contact_submissions
create policy "Anyone can insert contact submissions"
  on contact_submissions for insert
  to anon
  with check (true);

create policy "Admins can read contact submissions"
  on contact_submissions for select
  to authenticated
  using (
    exists (
      select 1
      from profiles
      where profiles.id = auth.uid()
      and profiles.email = 'drewnegron95@gmail.com'
    )
  );

create policy "Admins can update contact submissions"
  on contact_submissions for update
  to authenticated
  using (
    exists (
      select 1
      from profiles
      where profiles.id = auth.uid()
      and profiles.email = 'drewnegron95@gmail.com'
    )
  )
  with check (
    exists (
      select 1
      from profiles
      where profiles.id = auth.uid()
      and profiles.email = 'drewnegron95@gmail.com'
    )
  );

create policy "Admins can delete contact submissions"
  on contact_submissions for delete
  to authenticated
  using (
    exists (
      select 1
      from profiles
      where profiles.id = auth.uid()
      and profiles.email = 'drewnegron95@gmail.com'
    )
  );

-- Indexes for contact_submissions
create index if not exists contact_submissions_status_idx on contact_submissions(status);
create index if not exists contact_submissions_category_idx on contact_submissions(category);
create index if not exists contact_submissions_created_at_idx on contact_submissions(created_at desc);

-- Two-Factor Authentication Codes Table
create table if not exists two_factor_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  code text not null check (length(code) = 6),
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz default now()
);

alter table two_factor_codes enable row level security;

-- RLS Policies for two_factor_codes
create policy "Users can insert own 2FA codes"
  on two_factor_codes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can read own 2FA codes"
  on two_factor_codes for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can update own 2FA codes"
  on two_factor_codes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Indexes for two_factor_codes
create index if not exists two_factor_codes_user_id_idx on two_factor_codes(user_id);
create index if not exists two_factor_codes_expires_at_idx on two_factor_codes(expires_at);

create policy "Admins can read moderation logs"
  on moderation_logs for select
  to authenticated
  using (
    exists (
      select 1
      from profiles
      where profiles.id = auth.uid()
        and profiles.email = 'drewnegron95@gmail.com'
    )
  );

create policy "Users can insert own moderation logs"
  on moderation_logs for insert
  to authenticated
  with check (auth.uid() = user_id);

create index if not exists moderation_logs_user_id_idx on moderation_logs(user_id);
create index if not exists moderation_logs_category_idx on moderation_logs(category);
create index if not exists moderation_logs_status_idx on moderation_logs(status);
create index if not exists moderation_logs_created_at_idx on moderation_logs(created_at desc);

-- Helper functions for community post counts
create or replace function increment_community_post_like_count(post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update community_posts
  set like_count = like_count + 1
  where id = post_id;
end;
$$;

create or replace function decrement_community_post_like_count(post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update community_posts
  set like_count = greatest(like_count - 1, 0)
  where id = post_id;
end;
$$;

create or replace function increment_community_post_comment_count(post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- This function is a placeholder for comment count tracking
  -- Currently not implemented as comment count is calculated dynamically
  return;
end;
$$;

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

-- Add share_count and shared_post_id columns to existing community_posts table
alter table community_posts add column if not exists share_count int default 0;
alter table community_posts add column if not exists shared_post_id uuid references community_posts(id) on delete set null;

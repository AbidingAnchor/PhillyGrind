-- Quick Apply & Applications System
-- Run against your Supabase project: supabase db push (or paste in SQL editor)

-- ---------------------------------------------------------------------------
-- profiles: resume_url column (storage path to private resume PDF)
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists resume_url text;

update public.profiles
set resume_url = resume_path
where resume_url is null
  and resume_path is not null;

-- ---------------------------------------------------------------------------
-- applications table
-- ---------------------------------------------------------------------------

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  applicant_id uuid not null references auth.users(id) on delete cascade,
  resume_url text,
  cover_note text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (job_id, applicant_id)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_status_check'
      and conrelid = 'public.applications'::regclass
  ) then
    alter table public.applications
      add constraint applications_status_check check (status in ('pending', 'reviewed', 'accepted', 'rejected'));
  end if;
end $$;

alter table public.applications enable row level security;

drop policy if exists "Applicants can read own applications" on public.applications;
create policy "Applicants can read own applications"
  on public.applications for select
  using (auth.uid() = applicant_id);

drop policy if exists "Job posters can read applications for own jobs" on public.applications;
create policy "Job posters can read applications for own jobs"
  on public.applications for select
  using (
    exists (
      select 1
      from public.jobs
      where jobs.id = applications.job_id
        and jobs.user_id = auth.uid()
    )
  );

drop policy if exists "Applicants can submit applications" on public.applications;
create policy "Applicants can submit applications"
  on public.applications for insert
  with check (
    auth.uid() = applicant_id
    and exists (
      select 1
      from public.jobs
      where jobs.id = applications.job_id
        and jobs.user_id is distinct from auth.uid()
    )
  );

drop policy if exists "Job posters can update application status" on public.applications;
create policy "Job posters can update application status"
  on public.applications for update
  using (
    exists (
      select 1
      from public.jobs
      where jobs.id = applications.job_id
        and jobs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.jobs
      where jobs.id = applications.job_id
        and jobs.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- storage: resumes bucket (users upload/read own; job posters read applicants)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

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
      from public.applications a
      join public.jobs j on j.id = a.job_id
      where j.user_id = auth.uid()
        and a.resume_url = storage.objects.name
    )
  );

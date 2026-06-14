-- Quick Apply & Resume system
-- Run against your Supabase project: supabase db push (or paste in SQL editor)

-- ---------------------------------------------------------------------------
-- profiles: resume_url column (storage path in resumes bucket)
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
  resume_url text not null,
  cover_note text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique (job_id, applicant_id)
);

create index if not exists applications_job_id_idx on public.applications(job_id);
create index if not exists applications_applicant_id_idx on public.applications(applicant_id);

alter table public.applications enable row level security;

drop policy if exists "Applicants can read own applications" on public.applications;
create policy "Applicants can read own applications"
  on public.applications for select
  to authenticated
  using (auth.uid() = applicant_id);

drop policy if exists "Job posters can read applications for own jobs" on public.applications;
create policy "Job posters can read applications for own jobs"
  on public.applications for select
  to authenticated
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
  to authenticated
  with check (
    auth.uid() = applicant_id
    and exists (
      select 1
      from public.jobs
      where jobs.id = applications.job_id
        and jobs.user_id <> auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- resumes bucket (ensure exists) + employer read policy
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  5242880,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];

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

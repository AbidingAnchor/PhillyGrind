-- contact_submissions.resolved_at was documented in supabase-schema.sql but never migrated.
alter table public.contact_submissions
  add column if not exists resolved_at timestamptz;

notify pgrst, 'reload schema';

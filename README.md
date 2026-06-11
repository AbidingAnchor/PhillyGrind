# PhillyGrind

A local Philadelphia gig and job platform built with React, Vite, React Router, and Supabase.

## Run locally

```bash
npm install
npm run dev
```

The app uses demo listings until Supabase credentials are added. When Supabase is configured, jobs and gigs are loaded from the database, and posting requires a signed-in user.

## Supabase setup

Create `.env` from `.env.example`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Run [supabase-schema.sql](./supabase-schema.sql) in the Supabase SQL Editor to create:

- `jobs` and `gigs` listing tables
- `profiles` table with `id`, `name`, `email`, and `created_at`
- public read policies for jobs and gigs
- authenticated-only insert policies for posting
- a trigger that creates a profile automatically when a user signs up
- `messages` table for in-app chat
- Supabase realtime publication for new messages

The key profile/auth portion is:

```sql
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do update
    set name = excluded.name,
        email = excluded.email;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

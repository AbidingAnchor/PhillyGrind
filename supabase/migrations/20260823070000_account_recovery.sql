-- Locked-out account recovery (lost email). Service role only — no client policies.

create table if not exists public.account_recovery_challenges (
  id uuid primary key default gen_random_uuid(),
  claimed_user_id uuid references auth.users(id) on delete cascade,
  identifier_normalized text not null,
  questions jsonb not null,
  snapshot jsonb,
  requester_ip text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.account_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid unique references public.account_recovery_challenges(id) on delete set null,
  claimed_user_id uuid references auth.users(id) on delete cascade,
  identifier_raw text not null,
  identifier_normalized text not null,
  new_email text not null,
  questions_asked jsonb not null,
  answers jsonb not null,
  snapshot jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied')),
  requester_ip text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.account_recovery_tokens (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique
    references public.account_recovery_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  new_email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists account_recovery_requests_claimed_created_idx
  on public.account_recovery_requests (claimed_user_id, created_at desc);
create index if not exists account_recovery_requests_identifier_created_idx
  on public.account_recovery_requests (identifier_normalized, created_at desc);
create index if not exists account_recovery_requests_status_created_idx
  on public.account_recovery_requests (status, created_at desc);
create index if not exists account_recovery_requests_ip_created_idx
  on public.account_recovery_requests (requester_ip, created_at desc);
create index if not exists account_recovery_challenges_expires_idx
  on public.account_recovery_challenges (expires_at);

alter table public.account_recovery_challenges enable row level security;
alter table public.account_recovery_requests enable row level security;
alter table public.account_recovery_tokens enable row level security;

alter table public.admin_action_log drop constraint if exists admin_action_log_action_type_check;
alter table public.admin_action_log
  add constraint admin_action_log_action_type_check
  check (action_type in (
    'suspend',
    'ban',
    'ip_ban',
    'lift_suspension',
    'lift_ban',
    'assign_role',
    'recovery_approved',
    'recovery_denied'
  ));

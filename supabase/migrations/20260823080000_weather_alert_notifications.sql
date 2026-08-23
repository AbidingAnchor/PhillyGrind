alter table public.notifications
  add column if not exists alert_id text;

create index if not exists notifications_alert_id_idx
  on public.notifications (alert_id)
  where alert_id is not null;

create table if not exists public.alert_notification_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_id text not null,
  neighborhood text,
  created_at timestamptz not null default now(),
  primary key (user_id, alert_id)
);

create index if not exists alert_notification_receipts_alert_id_idx
  on public.alert_notification_receipts (alert_id);

alter table public.alert_notification_receipts enable row level security;

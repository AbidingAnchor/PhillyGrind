-- Dispute & Handoff Confirmation System
-- Run against your Supabase project: supabase db push (or paste in SQL editor)

-- ---------------------------------------------------------------------------
-- marketplace_orders: handoff columns + expanded status values
-- ---------------------------------------------------------------------------

create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  fee integer not null default 0,
  status text not null default 'pending',
  stripe_payment_intent_id text,
  confirmed_at timestamptz,
  handoff_at timestamptz,
  handoff_photo_url text,
  handoff_exif_data jsonb,
  handoff_tamper_score integer,
  handoff_ai_summary text,
  created_at timestamptz not null default now()
);

alter table public.marketplace_orders
  add column if not exists handoff_at timestamptz,
  add column if not exists handoff_photo_url text,
  add column if not exists handoff_exif_data jsonb,
  add column if not exists handoff_tamper_score integer,
  add column if not exists handoff_ai_summary text;

alter table public.marketplace_orders drop constraint if exists marketplace_orders_status_check;
alter table public.marketplace_orders
  add constraint marketplace_orders_status_check check (
    status in (
      'pending',
      'held',
      'delivered_pending_confirmation',
      'disputed',
      'completed',
      'released',
      'refunded',
      'cancelled'
    )
  );

alter table public.marketplace_orders enable row level security;

drop policy if exists "Buyers and sellers can view their marketplace orders" on public.marketplace_orders;
create policy "Buyers and sellers can view their marketplace orders"
  on public.marketplace_orders for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "Buyers can create marketplace orders" on public.marketplace_orders;
create policy "Buyers can create marketplace orders"
  on public.marketplace_orders for insert
  with check (auth.uid() = buyer_id);

drop policy if exists "Participants can update their marketplace orders" on public.marketplace_orders;
create policy "Participants can update their marketplace orders"
  on public.marketplace_orders for update
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- ---------------------------------------------------------------------------
-- disputes table
-- ---------------------------------------------------------------------------

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.marketplace_orders(id) on delete cascade,
  buyer_description text,
  buyer_photo_url text,
  buyer_exif_data jsonb,
  buyer_tamper_score integer,
  buyer_ai_summary text,
  seller_description text,
  seller_photo_url text,
  seller_exif_data jsonb,
  seller_tamper_score integer,
  seller_ai_summary text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolution text check (resolution is null or resolution in ('released_to_seller', 'refunded_to_buyer')),
  seller_evidence_deadline timestamptz,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.disputes enable row level security;

create or replace function public.is_dispute_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and lower(email) = 'drewnegron95@gmail.com'
  );
$$;

create or replace function public.is_dispute_buyer(dispute_row public.disputes)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.marketplace_orders mo
    where mo.id = dispute_row.order_id
      and mo.buyer_id = auth.uid()
  );
$$;

create or replace function public.is_dispute_seller(dispute_row public.disputes)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.marketplace_orders mo
    where mo.id = dispute_row.order_id
      and mo.seller_id = auth.uid()
  );
$$;

-- Admin sees full dispute rows
drop policy if exists "Admin can view all disputes" on public.disputes;
create policy "Admin can view all disputes"
  on public.disputes for select
  using (public.is_dispute_admin());

-- Buyers/sellers can see dispute rows they participate in (sensitive fields filtered via API)
drop policy if exists "Dispute participants can view their disputes" on public.disputes;
create policy "Dispute participants can view their disputes"
  on public.disputes for select
  using (public.is_dispute_buyer(disputes) or public.is_dispute_seller(disputes));

drop policy if exists "Buyers can open disputes" on public.disputes;
create policy "Buyers can open disputes"
  on public.disputes for insert
  with check (
    exists (
      select 1
      from public.marketplace_orders mo
      where mo.id = order_id
        and mo.buyer_id = auth.uid()
    )
  );

drop policy if exists "Sellers can submit dispute evidence" on public.disputes;
create policy "Sellers can submit dispute evidence"
  on public.disputes for update
  using (public.is_dispute_seller(disputes) and status = 'open')
  with check (public.is_dispute_seller(disputes));

drop policy if exists "Admin can resolve disputes" on public.disputes;
create policy "Admin can resolve disputes"
  on public.disputes for update
  using (public.is_dispute_admin());

-- ---------------------------------------------------------------------------
-- dispute-photos storage bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dispute-photos', 'dispute-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

drop policy if exists "Dispute photo uploads by authenticated users" on storage.objects;
create policy "Dispute photo uploads by authenticated users"
  on storage.objects for insert
  with check (
    bucket_id = 'dispute-photos'
    and auth.role() = 'authenticated'
  );

drop policy if exists "Dispute photo reads by order participants" on storage.objects;
create policy "Dispute photo reads by order participants"
  on storage.objects for select
  using (
    bucket_id = 'dispute-photos'
    and (
      public.is_dispute_admin()
      or exists (
        select 1
        from public.marketplace_orders mo
        where mo.id::text = (storage.foldername(name))[1]
          and (mo.buyer_id = auth.uid() or mo.seller_id = auth.uid())
      )
    )
  );

drop policy if exists "Dispute photo updates by uploader" on storage.objects;
create policy "Dispute photo updates by uploader"
  on storage.objects for update
  using (bucket_id = 'dispute-photos' and auth.role() = 'authenticated');

create index if not exists marketplace_orders_status_handoff_idx
  on public.marketplace_orders (status, handoff_at)
  where status = 'delivered_pending_confirmation';

create index if not exists disputes_status_idx
  on public.disputes (status)
  where status = 'open';

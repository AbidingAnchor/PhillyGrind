-- Read receipts: timestamp set when the recipient opens the thread.
alter table public.messages
  add column if not exists read_at timestamptz;

create index if not exists messages_unread_for_receiver_idx
  on public.messages (receiver_id, sender_id, listing_id)
  where read_at is null;

drop policy if exists "Receivers can mark messages read" on public.messages;
create policy "Receivers can mark messages read"
  on public.messages for update
  to authenticated
  using ((select auth.uid()) = receiver_id)
  with check ((select auth.uid()) = receiver_id);

create or replace function public.messages_read_at_update_guard()
returns trigger
language plpgsql
as $$
begin
  if new.sender_id is distinct from old.sender_id
    or new.receiver_id is distinct from old.receiver_id
    or new.listing_id is distinct from old.listing_id
    or new.content is distinct from old.content
    or new.created_at is distinct from old.created_at then
    raise exception 'Only read_at can be updated on messages';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_read_at_update_guard on public.messages;
create trigger messages_read_at_update_guard
  before update on public.messages
  for each row execute function public.messages_read_at_update_guard();

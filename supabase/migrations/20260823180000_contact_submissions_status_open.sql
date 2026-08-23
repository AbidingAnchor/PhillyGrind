-- Align contact_submissions.status with app (open | responded | resolved).
-- Legacy values were: new, in_progress, resolved.

update public.contact_submissions
set status = case
  when status = 'new' then 'open'
  when status = 'in_progress' then 'responded'
  else status
end
where status in ('new', 'in_progress');

alter table public.contact_submissions
  alter column status set default 'open';

alter table public.contact_submissions
  drop constraint if exists contact_submissions_status_check;

alter table public.contact_submissions
  add constraint contact_submissions_status_check
  check (status in ('open', 'responded', 'resolved'));

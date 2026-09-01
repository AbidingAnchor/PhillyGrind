-- Add weather alert email notification preference to profiles
alter table public.profiles
add column if not exists weather_alert_email_notifications boolean default true;

-- Add email column to alert_notification_receipts for tracking email sends
alter table public.alert_notification_receipts
add column if not exists email_sent boolean default false;

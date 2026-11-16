-- Rollback of 2026-11-place.sql: the booking rules go back to 2026-11-rules.sql (phone 9-15 digits), the place column is removed.
-- Run sql/2026-11-rules.sql after this file to restore the older rules.
alter table public.appts drop constraint if exists ruqya_appts_place;
alter table public.appts drop column if exists place;
select 'OK' as result;

-- Undo 2026-11-breaks-gcal.sql: left-out days and monthly breaks are forgotten (such a break then shows every day
-- of its weeks again — delete or change those breaks first).
alter table public.breaks drop constraint if exists ruqya_breaks_skip;
alter table public.breaks drop constraint if exists ruqya_breaks_mday;
alter table public.breaks drop column if exists skip;
alter table public.breaks drop column if exists mday;
select 'OK' as result;

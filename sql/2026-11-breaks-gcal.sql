-- Mərkəz (owner 22.11): breaks like Google Calendar. A repeating break can leave out single days (skip) and can
-- repeat every month on one day of the month (mday). Adds two empty columns; changes no data. Safe to run again.
-- Undo: rollback-2026-11-breaks-gcal.sql
alter table public.breaks add column if not exists skip date[];
alter table public.breaks add column if not exists mday smallint;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ruqya_breaks_mday') then
    alter table public.breaks add constraint ruqya_breaks_mday check (mday is null or mday between 1 and 31);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ruqya_breaks_skip') then
    alter table public.breaks add constraint ruqya_breaks_skip check (skip is null or cardinality(skip) <= 400);
  end if;
end $$;
select 'OK' as result;

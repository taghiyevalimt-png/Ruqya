-- Undo 2026-11-breaks.sql: removes the per-specialist breaks and the column (breaks for everyone stay).
delete from public.breaks where reader_id is not null;
drop index if exists public.breaks_reader_id;
alter table public.breaks drop column if exists reader_id;

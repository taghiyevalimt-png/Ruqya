-- Undo 2026-11-stat-edits2.sql (removes the daily and "Müraciət" numbers first).
delete from public.stat_edits where per = 'day' or col = 'r';
alter table public.stat_edits drop constraint if exists stat_edits_per_check;
alter table public.stat_edits add constraint stat_edits_per_check check (per in ('week','month'));
alter table public.stat_edits drop constraint if exists stat_edits_col_check;
alter table public.stat_edits add constraint stat_edits_col_check check (col in ('a','b'));

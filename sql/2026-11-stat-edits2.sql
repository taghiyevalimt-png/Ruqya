-- Ruqyatz: the sales statistics also get a "Müraciət" (requests) column and daily tables; both can be written by
-- agents and admins like the other numbers. Safe to run more than once. Undo: rollback-2026-11-stat-edits2.sql
alter table public.stat_edits drop constraint if exists stat_edits_per_check;
alter table public.stat_edits add constraint stat_edits_per_check check (per in ('day','week','month'));
alter table public.stat_edits drop constraint if exists stat_edits_col_check;
alter table public.stat_edits add constraint stat_edits_col_check check (col in ('r','a','b'));

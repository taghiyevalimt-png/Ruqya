-- Undo of 2026-11-a6-journal-index.sql: the two indexes go; nothing else changes.
drop index if exists public.audit_log_del_pkey;
drop index if exists public.audit_log_appts_row;
select 'OK' as result;

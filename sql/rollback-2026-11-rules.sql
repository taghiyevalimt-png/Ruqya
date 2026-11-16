-- Rollback of 2026-11-rules.sql
drop trigger if exists ruqya_appt_rules on public.appts;
drop function if exists public.ruqya_appt_rules();
select 'OK' as result;

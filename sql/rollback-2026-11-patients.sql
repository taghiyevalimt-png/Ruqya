-- Rollback of 2026-11-patients.sql: the app then loads the old visits themselves again (as before).
drop function if exists public.ruqya_hist_visits(text,date,date);
drop function if exists public.ruqya_hist_patients(date,date);
drop function if exists public.ruqya_pkey(text,text);
select 'OK' as result;

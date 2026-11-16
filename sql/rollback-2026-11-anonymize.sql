-- Rollback of 2026-11-anonymize.sql: removes the functions. Data already wiped cannot be brought back.
drop function if exists public.ruqya_anonymize(text);
drop function if exists public.ruqya_scrub(jsonb);
select 'OK' as result;

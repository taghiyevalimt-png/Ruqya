-- Rollback of sql/2026-11-app-errors.sql (the phones then keep their errors only in their own list).
drop table if exists public.app_errors;
drop function if exists public.ruqya_err_ok();
select 'OK' as result;

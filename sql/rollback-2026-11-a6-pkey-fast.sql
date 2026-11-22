-- Undo of 2026-11-a6-pkey-fast.sql: the SQL version of ruqya_pkey from 2026-11-a5-patient-key.sql (same result).
create or replace function public.ruqya_pkey(p_phone text, p_name text) returns text
language sql immutable set search_path = public as $$
  select case when length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 7
    then 'p' || right(regexp_replace(p_phone, '\D', '', 'g'), 9) || '|' || public.ruqya_pnorm(p_name)
    else 'n' || public.ruqya_pnorm(p_name) end $$;
reindex index public.appts_pkey_date;
do $$ begin if to_regclass('public.audit_log_del_pkey') is not null then execute 'reindex index public.audit_log_del_pkey'; end if; end $$;
select 'OK' as result;

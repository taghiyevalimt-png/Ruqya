-- Audit 6, A6-11: the patient key (ruqya_pkey) is computed for every visit the patient list reads. As an SQL function
-- with «set search_path» it could not be inlined and computed the phone digits twice: 22 µs a call, so a patient list
-- page took 300–340 ms with 66 000 bookings and seconds with 50 users at once (P-08). The same rule in PL/pgSQL, the
-- digits once: 3.6 times faster (copy: 1 457 → 401 ms for 66 000 keys). The result is the same for every row (checked
-- on the 10-year copy: 1 000 000 bookings, 0 differences), so the index on it stays valid; it is rebuilt anyway.
-- Safe to run again. Undo: rollback-2026-11-a6-pkey-fast.sql
create or replace function public.ruqya_pkey(p_phone text, p_name text) returns text
language plpgsql immutable parallel safe set search_path = public as $$
declare d text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  return case when length(d) >= 7 then 'p' || right(d, 9) || '|' || public.ruqya_pnorm(p_name) else 'n' || public.ruqya_pnorm(p_name) end;
end $$;
reindex index public.appts_pkey_date;
do $$ begin if to_regclass('public.audit_log_del_pkey') is not null then execute 'reindex index public.audit_log_del_pkey'; end if; end $$;
select 'OK' as result;

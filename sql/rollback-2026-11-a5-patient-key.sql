-- Undo 2026-11-a5-patient-key.sql: one phone number = one patient again (the app before audit 5 expects this).
create or replace function public.ruqya_pkey(p_phone text, p_name text) returns text
language sql immutable set search_path = public as $$
  select case when length(regexp_replace(coalesce(p_phone,''), '\D', '', 'g')) >= 7
    then 'p' || right(regexp_replace(p_phone, '\D', '', 'g'), 9)
    else 'n' || replace(replace(lower(btrim(coalesce(p_name,''))), U&'\0307', ''), 'ı', 'i') end $$;
reindex index public.appts_pkey_date;
-- the history page as it was (SQL function)
drop function if exists public.ruqya_hist_patients_page(date, date, text, integer);
CREATE OR REPLACE FUNCTION public.ruqya_hist_patients_page(before date, since date, after_k text DEFAULT ''::text, lim integer DEFAULT 1000)
 RETURNS TABLE(k text, name text, phone text, n integer, noshow integer, cancel integer, last date, first date)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select public.ruqya_pkey(a.phone, a.name),
         (array_agg(a.name order by a.date desc, a.id))[1],
         (array_agg(a.phone order by a.date desc, a.id) filter (where coalesce(a.phone,'') <> ''))[1],
         (count(*) filter (where (case when a.status = 'cancel' and coalesce(a.follow, 0) >= 3 then 'wait' else a.status end) not in ('cancel','noshow')))::int,
         (count(*) filter (where a.status = 'noshow'))::int,
         (count(*) filter (where (case when a.status = 'cancel' and coalesce(a.follow, 0) >= 3 then 'wait' else a.status end) = 'cancel'))::int,
         max(a.date),
         min(a.date) filter (where (case when a.status = 'cancel' and coalesce(a.follow, 0) >= 3 then 'wait' else a.status end) not in ('cancel','noshow'))
    from public.appts a
   where public.ruqya_pkey(a.phone, a.name) > coalesce(after_k, '')
     and a.date >= greatest(since, current_date - 800) and a.date < before
   group by public.ruqya_pkey(a.phone, a.name)
   order by public.ruqya_pkey(a.phone, a.name)
   limit least(greatest(coalesce(lim, 1000), 1), 1000) $function$;
grant execute on function public.ruqya_hist_patients_page(date, date, text, integer) to authenticated, service_role;
revoke execute on function public.ruqya_hist_patients_page(date, date, text, integer) from public, anon;
drop function if exists public.ruqya_pnorm(text);
select 'OK' as result;

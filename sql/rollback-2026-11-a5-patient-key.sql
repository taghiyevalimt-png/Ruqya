-- Undo 2026-11-a5-patient-key.sql: one phone number = one patient again (the app before audit 5 expects this).
create or replace function public.ruqya_pkey(p_phone text, p_name text) returns text
language sql immutable set search_path = public as $$
  select case when length(regexp_replace(coalesce(p_phone,''), '\D', '', 'g')) >= 7
    then 'p' || right(regexp_replace(p_phone, '\D', '', 'g'), 9)
    else 'n' || replace(replace(lower(btrim(coalesce(p_name,''))), U&'\0307', ''), 'ı', 'i') end $$;
reindex index public.appts_pkey_date;
drop function if exists public.ruqya_pnorm(text);
select 'OK' as result;

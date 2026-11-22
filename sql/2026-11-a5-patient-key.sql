-- Audit 5, A5-K3 (owner 22.11): a patient is the phone number + the name, not the phone number alone — relatives
-- booked with one number (a mother and her son) were one patient and only the last name was shown. Names are compared
-- without case, extra or invisible spaces and Azerbaijani letters (Məmmədova = Memmedova; ё = е), exactly like the
-- app's pkey() / fold(). Without a phone number (fewer than 7 digits) the name alone, as before.
-- Every function that groups patients uses ruqya_pkey (history pages, visits, anonymisation, own contacts), so they
-- all follow; the index on ruqya_pkey is built again. Safe to run again. Undo: rollback-2026-11-a5-patient-key.sql
create or replace function public.ruqya_pnorm(t text) returns text
language sql immutable parallel safe set search_path = public as $$
  select btrim(regexp_replace(
           translate(replace(lower(translate(regexp_replace(normalize(coalesce(t, ''), NFC), U&'[\200B\200C\200D\2060\FEFF]', '', 'g'),
                                             U&'\018F\00C7\015E\011E\00D6\00DC\0130I\0401', U&'\0259\00E7\015F\011F\00F6\00FC\0069\0069\0451')),
                             U&'\0307', ''),
                     U&'\0259\00E7\015F\011F\00F6\00FC\0131\0451', U&'ecsgoui\0435'),
           U&'[\0009\000A\000D\0020\00A0]+', ' ', 'g')) $$;
revoke all on function public.ruqya_pnorm(text) from public, anon;
grant execute on function public.ruqya_pnorm(text) to authenticated;

create or replace function public.ruqya_pkey(p_phone text, p_name text) returns text
language sql immutable set search_path = public as $$
  select case when length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 7
    then 'p' || right(regexp_replace(p_phone, '\D', '', 'g'), 9) || '|' || public.ruqya_pnorm(p_name)
    else 'n' || public.ruqya_pnorm(p_name) end $$;

reindex index public.appts_pkey_date;
select 'OK' as result;

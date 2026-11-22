-- Audit 5, A5-K3 (owner 22.11): a patient is the phone number + the name, not the phone number alone — relatives
-- booked with one number (a mother and her son) were one patient and only the last name was shown. Names are compared
-- without case, extra or invisible spaces and Azerbaijani letters (Məmmədova = Memmedova; ё = е), exactly like the
-- app's pkey() / fold(). Without a phone number (fewer than 7 digits) the name alone, as before.
-- Every function that groups patients uses ruqya_pkey (history pages, visits, anonymisation, own contacts), so they
-- all follow; the index on ruqya_pkey is built again. Safe to run again. Undo: rollback-2026-11-a5-patient-key.sql
create or replace function public.ruqya_pnorm(t text) returns text
language sql immutable parallel safe set search_path = public as $$
  select btrim(regexp_replace(
           translate(replace(lower(translate(normalize(coalesce(t, ''), NFC),
                                             U&'\018F\00C7\015E\011E\00D6\00DC\0130I\0401\200B\200C\200D\2060\FEFF', U&'\0259\00E7\015F\011F\00F6\00FC\0069\0069\0451')),
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
-- the history pages are planned for the real page: as an SQL function the query was planned without its values and read
-- and sorted two years of bookings (57 ms → 11 s on the 10-year copy once the name is in the key); the same query in
-- PL/pgSQL with custom plans uses the index on ruqya_pkey
create or replace function public.ruqya_hist_patients_page(before date, since date, after_k text default '', lim integer default 1000)
returns table(k text, name text, phone text, n integer, noshow integer, cancel integer, last date, first date)
language plpgsql stable set search_path = public set plan_cache_mode = force_custom_plan as $f$
begin
  return query
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
   limit least(greatest(coalesce(lim, 1000), 1), 1000);
end $f$;
-- phone contacts stay one per NUMBER (owner 18.11: «the same number twice is one contact», the latest name); with the
-- name in the patient key they would come twice for relatives sharing a phone
create or replace function public.ruqya_my_contacts(since date)
returns table(name text, phone text)
language sql stable security invoker set search_path = public as $$
  select x.name, x.phone from (
    select distinct on (right(regexp_replace(a.phone, '\D', '', 'g'), 9)) a.name, a.phone, a.date
      from public.appts a
     where a.created_by = auth.uid()
       and a.date >= greatest(since, current_date - 800)
       and coalesce(btrim(a.phone), '') <> ''
     order by right(regexp_replace(a.phone, '\D', '', 'g'), 9), a.date desc, a.id
  ) x
  order by x.name
  limit 5000 $$;
select 'OK' as result;

-- P-04 / P-05 (audit 4, test with 1 000 000 bookings): the patient list and a patient's old visits read every
-- booking of two years (≈ 626 000 rows, 5–9 s per request; the list again for every page of 1000).
--  1. an index on the patient key (the same key the app groups by) and the date: a patient's visits are found
--     through it, and the list is read in key order;
--  2. ruqya_hist_patients_page: the grouped list one page at a time, after the last key of the previous page
--     (keyset paging), so each page reads only its own patients. The old ruqya_hist_patients (whole list for every
--     page) is dropped: this app no longer calls it, and older app versions fall back to reading the visits.
-- Safe to run again. Rollback: sql/rollback-2026-11-patients-scale.sql.
create index if not exists appts_pkey_date on public.appts (public.ruqya_pkey(phone, name), date);

create or replace function public.ruqya_hist_patients_page(before date, since date, after_k text default '', lim int default 1000)
returns table(k text, name text, phone text, n int, noshow int, cancel int, last date, first date)
language sql stable security invoker set search_path = public as $$
  select public.ruqya_pkey(a.phone, a.name),
         (array_agg(a.name order by a.date desc, a.id))[1],
         (array_agg(a.phone order by a.date desc, a.id) filter (where coalesce(a.phone,'') <> ''))[1],
         (count(*) filter (where a.status not in ('cancel','noshow')))::int,
         (count(*) filter (where a.status = 'noshow'))::int,
         (count(*) filter (where a.status = 'cancel'))::int,
         max(a.date),
         min(a.date) filter (where a.status not in ('cancel','noshow'))
    from public.appts a
   where public.ruqya_pkey(a.phone, a.name) > coalesce(after_k, '')
     and a.date >= greatest(since, current_date - 800) and a.date < before
   group by public.ruqya_pkey(a.phone, a.name)
   order by public.ruqya_pkey(a.phone, a.name)
   limit least(greatest(coalesce(lim, 1000), 1), 1000) $$;

revoke all on function public.ruqya_hist_patients_page(date, date, text, int) from public;
revoke all on function public.ruqya_hist_patients_page(date, date, text, int) from anon;
grant execute on function public.ruqya_hist_patients_page(date, date, text, int) to authenticated;

-- 3. a patient's old visits. Under row-level security PostgreSQL does not let the key condition use the index
--    (ruqya_pkey is not marked LEAKPROOF, and only a superuser may mark it), so ruqya_hist_visits read all bookings
--    of two years. The ids are now found through the index by a helper in schema "private" (not exposed by the
--    API, so no client can call it), and the rows themselves are still read with the caller's rights (RLS):
--    a specialist sees only own column, as before. The helper returns ids only, never booking data.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create or replace function private.ruqya_visit_ids(key text, before date, since date)
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(s.id), '{}') from (
    select a.id from public.appts a
     where public.ruqya_pkey(a.phone, a.name) = key
       and a.date >= greatest(since, current_date - 800) and a.date < before
       -- the same rule as the read policies of appts (ruqya_appts_read, ruqya_no_anonymous): even called by direct
       -- SQL it gives out only ids of rows the caller may read (stage 7 pentest F-1)
       and (public.ruqya_sees_all() or a.reader_id in (select public.ruqya_my_readers()))
       and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
     order by a.date desc, a.id limit 500) s $$;
revoke all on function private.ruqya_visit_ids(text, date, date) from public;
revoke all on function private.ruqya_visit_ids(text, date, date) from anon;
grant execute on function private.ruqya_visit_ids(text, date, date) to authenticated;

create or replace function public.ruqya_hist_visits(key text, before date, since date)
returns table(id uuid, reader_id uuid, date date, name text, phone text, status text, created_by uuid)
language sql stable set search_path = public as $$
  select a.id, a.reader_id, a.date, a.name, a.phone, a.status, a.created_by from public.appts a
  where a.id = any(private.ruqya_visit_ids(key, before, since))
  order by a.date desc, a.id limit 500 $$;
drop function if exists public.ruqya_hist_patients(date, date);
analyze public.appts;
select 'OK' as result;

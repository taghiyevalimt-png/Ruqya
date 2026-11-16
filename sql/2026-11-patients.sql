-- Patients list without downloading two years of visits (audit F-04).
-- ruqya_hist_patients: one short row per patient for the visits before the weeks the app already loads.
-- ruqya_hist_visits: the old visits of one patient, when the card is opened.
-- Both run with the caller's rights (security invoker), so row security still decides what each person sees:
-- a specialist gets only his own sessions, a person without a role gets nothing.
-- The patient key is the same as in the app (pkey): "p" + the last 9 digits of the phone when the phone has
-- at least 7 digits, otherwise "n" + the lower-case name (dotless ı -> i, combining dot removed).
-- Safe to run again. Rollback: sql/rollback-2026-11-patients.sql

create or replace function public.ruqya_pkey(p_phone text, p_name text) returns text
language sql immutable set search_path = public as $$
  select case
    when length(regexp_replace(coalesce(p_phone,''), '\D', '', 'g')) >= 7
      then 'p' || right(regexp_replace(p_phone, '\D', '', 'g'), 9)
    else 'n' || replace(replace(lower(btrim(coalesce(p_name,''))), U&'\0307', ''), 'ı', 'i')
  end $$;

create or replace function public.ruqya_hist_patients(before date, since date)
returns table(k text, name text, phone text, n int, noshow int, cancel int, last date, first date)
language sql stable security invoker set search_path = public as $$
  select x.k,
         (array_agg(x.name order by x.date desc, x.id))[1],
         (array_agg(x.phone order by x.date desc, x.id) filter (where coalesce(x.phone,'') <> ''))[1],
         (count(*) filter (where x.status not in ('cancel','noshow')))::int,
         (count(*) filter (where x.status = 'noshow'))::int,
         (count(*) filter (where x.status = 'cancel'))::int,
         max(x.date),
         min(x.date) filter (where x.status not in ('cancel','noshow'))
    from (select a.id, a.date, a.name, a.phone, a.status, public.ruqya_pkey(a.phone, a.name) k
            from public.appts a
           where a.date >= greatest(since, current_date - 800) and a.date < before) x
   group by x.k $$;

create or replace function public.ruqya_hist_visits(key text, before date, since date)
returns table(id uuid, reader_id uuid, date date, name text, phone text, status text, created_by uuid)
language sql stable security invoker set search_path = public as $$
  select a.id, a.reader_id, a.date, a.name, a.phone, a.status, a.created_by
    from public.appts a
   where a.date >= greatest(since, current_date - 800) and a.date < before
     and public.ruqya_pkey(a.phone, a.name) = key
   order by a.date desc, a.id
   limit 500 $$;

revoke all on function public.ruqya_pkey(text,text) from public, anon;
revoke all on function public.ruqya_hist_patients(date,date) from public, anon;
revoke all on function public.ruqya_hist_visits(text,date,date) from public, anon;
grant execute on function public.ruqya_pkey(text,text) to authenticated;
grant execute on function public.ruqya_hist_patients(date,date) to authenticated;
grant execute on function public.ruqya_hist_visits(text,date,date) to authenticated;
select 'OK' as result;

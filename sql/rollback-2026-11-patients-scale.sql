-- Rollback of 2026-11-patients-scale.sql. The app falls back to ruqya_hist_patients when the page function is gone.
-- ruqya_hist_visits goes back to the version of db/schema_live_20261116.sql (reads by date, filters by key).
create or replace function public.ruqya_hist_visits(key text, before date, since date)
returns table(id uuid, reader_id uuid, date date, name text, phone text, status text, created_by uuid)
language sql stable set search_path = public as $$
  select a.id, a.reader_id, a.date, a.name, a.phone, a.status, a.created_by from public.appts a
  where a.date >= greatest(since, current_date - 800) and a.date < before
    and public.ruqya_pkey(a.phone, a.name) = key
  order by a.date desc, a.id limit 500 $$;
drop function if exists private.ruqya_visit_ids(text, date, date);
do $$ begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'private')
     and not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private')
  then drop schema if exists private; end if;
end $$;
drop function if exists public.ruqya_hist_patients_page(date, date, text, int);
-- the old grouped list, as in 2026-11-patients-order.sql
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
   group by x.k
   order by x.k $$;
revoke all on function public.ruqya_hist_patients(date, date) from public, anon;
grant execute on function public.ruqya_hist_patients(date, date) to authenticated;
drop index if exists public.appts_pkey_date;
select 'OK' as result;

-- Rollback of 2026-11-patients-order.sql
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
select 'OK' as result;

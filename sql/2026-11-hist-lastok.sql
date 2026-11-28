-- 28.11.2026 (found in the check): «Pasiyentlər → Qayıtmayanlar» (came 14–90 days ago, nothing since) lost every patient
-- whose last visit is older than the weeks the app keeps loaded (the older visits come grouped from this function, and
-- its «last» is the last day of ANY visit, also a cancelled one). It now also returns «lastok»: the last day of a visit
-- that took place (not cancelled / no-show; «Satış edildi» counts, as everywhere). The return type changes, so the
-- function is dropped and created again with the same body, owner, rights (authenticated only) and SECURITY INVOKER.
-- Old app versions read the same columns and ignore the new one. Rollback: sql/rollback-2026-11-hist-lastok.sql.
begin;
drop function if exists public.ruqya_hist_patients_page(date, date, text, integer);
create function public.ruqya_hist_patients_page(before date, since date, after_k text default '', lim integer default 1000)
returns table(k text, name text, phone text, n integer, noshow integer, cancel integer, last date, first date, lastok date)
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
         min(a.date) filter (where (case when a.status = 'cancel' and coalesce(a.follow, 0) >= 3 then 'wait' else a.status end) not in ('cancel','noshow')),
         max(a.date) filter (where (case when a.status = 'cancel' and coalesce(a.follow, 0) >= 3 then 'wait' else a.status end) not in ('cancel','noshow'))
    from public.appts a
   where public.ruqya_pkey(a.phone, a.name) > coalesce(after_k, '')
     and a.date >= greatest(since, current_date - 800) and a.date < before
   group by public.ruqya_pkey(a.phone, a.name)
   order by public.ruqya_pkey(a.phone, a.name)
   limit least(greatest(coalesce(lim, 1000), 1), 1000);
end $f$;
revoke all on function public.ruqya_hist_patients_page(date, date, text, integer) from public, anon;
grant execute on function public.ruqya_hist_patients_page(date, date, text, integer) to authenticated, service_role;
commit;

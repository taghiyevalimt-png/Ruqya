-- Owner 18.11: a sales agent adds to his phone's contacts only the patients he wrote himself. The app keeps only the
-- last weeks' bookings with their author; older patients come as a summary without it. This function gives the
-- caller the name and phone of every patient he wrote in two years (the latest name of each patient), read with the
-- caller's own rights (row-level security), nothing else.
-- Safe to run again. Rollback: sql/rollback-2026-11-my-contacts.sql
create or replace function public.ruqya_my_contacts(since date)
returns table(name text, phone text)
language sql stable security invoker set search_path = public as $$
  select x.name, x.phone from (
    select distinct on (public.ruqya_pkey(a.phone, a.name)) a.name, a.phone, a.date
      from public.appts a
     where a.created_by = auth.uid()
       and a.date >= greatest(since, current_date - 800)
       and coalesce(btrim(a.phone), '') <> ''
     order by public.ruqya_pkey(a.phone, a.name), a.date desc, a.id
  ) x
  order by x.name
  limit 5000 $$;
revoke all on function public.ruqya_my_contacts(date) from public;
revoke all on function public.ruqya_my_contacts(date) from anon;
grant execute on function public.ruqya_my_contacts(date) to authenticated;
select 'OK' as result;

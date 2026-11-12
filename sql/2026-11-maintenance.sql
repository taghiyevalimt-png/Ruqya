-- Ruqyatz: upkeep for years of use. Safe to run more than once; deletes no data.

-- 1. The change journal keeps one year (the free database holds 500 MB).
create index if not exists audit_log_at on public.audit_log (at);

create or replace function public.ruqya_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (uid, tbl, op, row_id, new)
      values (auth.uid(), tg_table_name, tg_op, new.id::text, to_jsonb(new));
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (uid, tbl, op, row_id, old)
      values (auth.uid(), tg_table_name, tg_op, old.id::text, to_jsonb(old));
  elsif (to_jsonb(old) - 'updated_at') is distinct from (to_jsonb(new) - 'updated_at') then
    insert into public.audit_log (uid, tbl, op, row_id, old, new)
      values (auth.uid(), tg_table_name, tg_op, new.id::text, to_jsonb(old), to_jsonb(new));
  end if;
  if random() < 0.005 then
    delete from public.audit_log
      where id in (select id from public.audit_log where at < now() - interval '365 days' order by id limit 2000);
  end if;
  return null;
end $$;

-- 2. Fast reads by date when there are years of bookings.
create index if not exists appts_date on public.appts (date);
create index if not exists appts_updated on public.appts (updated_at);
create index if not exists expenses_date on public.expenses (date);
create index if not exists product_sales_date on public.product_sales (date);

-- 3. Security advisor notices.
alter function public.ruqya_min(text) set search_path = public;
alter function public.ruqya_stamp() set search_path = public;
revoke execute on function public.ruqya_audit() from public, anon, authenticated;
revoke execute on function public.ruqya_stamp() from public, anon, authenticated;
revoke execute on function public.ruqya_is_admin() from public, anon;
grant execute on function public.ruqya_is_admin() to authenticated;
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- 4. One policy per rule (the older owner-only ones are covered by the admin ones; the owner is always admin).
drop policy if exists "owner readers" on public.readers;
drop policy if exists "owner breaks" on public.breaks;
drop policy if exists ruqya_readers_admin on public.readers;
create policy ruqya_readers_admin on public.readers for all to authenticated
  using ((select public.ruqya_is_admin())) with check ((select public.ruqya_is_admin()));
drop policy if exists ruqya_breaks_admin on public.breaks;
create policy ruqya_breaks_admin on public.breaks for all to authenticated
  using ((select public.ruqya_is_admin())) with check ((select public.ruqya_is_admin()));
drop policy if exists ruqya_staff_admin on public.staff;
create policy ruqya_staff_admin on public.staff for update to authenticated
  using ((select public.ruqya_is_admin())) with check ((select public.ruqya_is_admin()));
drop policy if exists ruqya_audit_owner on public.audit_log;
create policy ruqya_audit_owner on public.audit_log for select to authenticated
  using ((select public.ruqya_is_admin()));
drop policy if exists "own staff" on public.staff;
create policy "own staff" on public.staff for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

select 'Hazirdir' as netice;

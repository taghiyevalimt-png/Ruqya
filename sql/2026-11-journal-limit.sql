-- Ruqyatz: keep the change journal from filling the free database (500 MB).
-- Entries older than one year are removed automatically, a little at a time.
-- Safe to run more than once. Bookings, payments and everything else stay untouched.

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
  -- About once in 200 changes, remove up to 2000 journal entries older than a year.
  if random() < 0.005 then
    delete from public.audit_log
      where id in (select id from public.audit_log where at < now() - interval '365 days' order by id limit 2000);
  end if;
  return null;
end $$;

revoke execute on function public.ruqya_audit() from public, anon, authenticated;

select 'Hazirdir' as netice;

-- Undo of 2026-11-stability.sql (journal back to full copies, overlap check as before, indexes as before).
-- The staff guard is restored by running 2026-11-privacy.sql again after this file.
alter function public.ruqya_no_overlap() security definer;
drop index if exists public.readers_name_norm;
drop index if exists public.appts_created;
drop index if exists public.audit_log_at_brin;
create index if not exists audit_log_at on public.audit_log (at);
create or replace function public.ruqya_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (uid, tbl, op, row_id, new) values (auth.uid(), tg_table_name, tg_op, new.id::text, to_jsonb(new));
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (uid, tbl, op, row_id, old) values (auth.uid(), tg_table_name, tg_op, old.id::text, to_jsonb(old));
  elsif (to_jsonb(old) - 'updated_at') is distinct from (to_jsonb(new) - 'updated_at') then
    insert into public.audit_log (uid, tbl, op, row_id, old, new) values (auth.uid(), tg_table_name, tg_op, new.id::text, to_jsonb(old), to_jsonb(new));
  end if;
  if random() < 0.005 then
    delete from public.audit_log where id in (select id from public.audit_log where at < now() - interval '365 days' order by id limit 2000);
  end if;
  return null;
end $$;
select 'OK' as result;

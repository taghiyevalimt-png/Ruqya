-- Mərkəz: size limits and a per-person change limit, so one account (even one still waiting for a role)
-- cannot fill the 500 MB database through the change journal. Safe to run more than once. Changes no data.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ruqya_staff_name_len') then
    alter table public.staff add constraint ruqya_staff_name_len check (char_length(name) <= 60) not valid; end if;
  if not exists (select 1 from pg_constraint where conname = 'ruqya_breaks_text') then
    alter table public.breaks add constraint ruqya_breaks_text check (char_length(title) <= 100
      and start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
      and end_time   ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$') not valid; end if;
end $$;
alter table public.staff validate constraint ruqya_staff_name_len;
alter table public.breaks validate constraint ruqya_breaks_text;

-- at most 300 journal lines per person per hour (admins and the SQL Editor are not limited)
create index if not exists audit_log_uid_at on public.audit_log (uid, at);
create or replace function public.ruqya_throttle() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.ruqya_is_admin()
     and (select count(*) from (select 1 from public.audit_log where uid = auth.uid() and at > now() - interval '1 hour' limit 301) x) > 300 then
    raise exception 'Bir saatda cox deyisiklik' using errcode = '54000';
  end if;
  return null;
end $$;
revoke all on function public.ruqya_throttle() from public, anon, authenticated;
do $$ declare t text; begin
  foreach t in array array['appts','expenses','product_sales','staff','readers','breaks','stat_edits'] loop
    execute format('drop trigger if exists ruqya_zthrottle on public.%I', t);
    -- AFTER and named after ruqya_audit, so it also counts the lines written earlier in the same statement
    execute format('create trigger ruqya_zthrottle after insert or update or delete on public.%I for each row execute function public.ruqya_throttle()', t);
  end loop;
end $$;
select 'OK' as result;

-- 2026-11-limits-b.sql — fourth database review (run once in the SQL editor; safe to run again)
-- 1) size limits that were missing live (staff.want, product_sales.names, appts.service)
-- 2) change limit also counts size: 1 MB per person per hour, 8 MB per day (normal work ~0.2 MB/day; admins free)
-- 3) agents read only their own statistics corrections
-- 4) updates that change nothing are skipped (no table bloat, no realtime spam)
-- 5) indexes for the journal (restore marks, "only deleted")
-- 6) restore: clear message when a row cannot come back (taken name, deleted specialist, double click)
do $$ begin
  if not exists (select 1 from pg_constraint where conname='ruqya_staff_want') then
    alter table public.staff add constraint ruqya_staff_want check (want is null or want in ('agent','specialist')); end if;
  if not exists (select 1 from pg_constraint where conname='ruqya_products_names') then
    alter table public.product_sales add constraint ruqya_products_names check (char_length(coalesce(names,'')) <= 2000); end if;
  if not exists (select 1 from pg_constraint where conname='ruqya_appts_service') then
    alter table public.appts add constraint ruqya_appts_service check (char_length(service) <= 100); end if;
end $$;
create or replace function public.ruqya_throttle() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; b bigint; d bigint;
begin
  if auth.uid() is null or public.ruqya_is_admin() then return null; end if;
  select count(*), coalesce(sum(s),0) into n, b from (
    select coalesce(pg_column_size(l.old),0) + coalesce(pg_column_size(l.new),0) s from public.audit_log l
     where l.uid = auth.uid() and l.at > now() - interval '1 hour' limit 301) x;
  if n > 300 or b > 1024*1024 then raise exception 'Bir saatda cox deyisiklik' using errcode = '54000'; end if;
  select coalesce(sum(coalesce(pg_column_size(l.old),0) + coalesce(pg_column_size(l.new),0)),0) into d
    from public.audit_log l where l.uid = auth.uid() and l.at > now() - interval '1 day';
  if d > 8*1024*1024 then raise exception 'Bir saatda cox deyisiklik' using errcode = '54000'; end if;
  return null;
end $$;
revoke all on function public.ruqya_throttle() from public, anon, authenticated;
drop policy if exists "read stat edits" on public.stat_edits;
create policy "read stat edits" on public.stat_edits for select to authenticated
  using ((select public.ruqya_is_admin()) or ((select public.ruqya_can_stats()) and agent_id = (select auth.uid())::text));
create index if not exists audit_log_row_ins on public.audit_log (row_id) where op = 'INSERT';
create index if not exists audit_log_del on public.audit_log (id) where op = 'DELETE';
create or replace function public.ruqya_skip_noop() returns trigger language plpgsql set search_path = public as $$
begin
  if (to_jsonb(new) - array['updated_at','updated_by']) = (to_jsonb(old) - array['updated_at','updated_by']) then return null; end if;
  return new;
end $$;
revoke all on function public.ruqya_skip_noop() from public, anon, authenticated;
drop trigger if exists ruqya_a_noop on public.appts;
create trigger ruqya_a_noop before update on public.appts for each row execute function public.ruqya_skip_noop();
drop trigger if exists ruqya_a_noop on public.stat_edits;
create trigger ruqya_a_noop before update on public.stat_edits for each row execute function public.ruqya_skip_noop();
revoke all on function public.ruqya_stat_stamp() from public, anon, authenticated;
create or replace function public.ruqya_restore(aid bigint) returns text
language plpgsql security definer set search_path = public as $$
declare a public.audit_log; rec jsonb; ex boolean; iu uuid; iat timestamptz;
begin
  if not public.ruqya_is_admin() then raise exception 'Yalniz admin berpa edir' using errcode = '42501'; end if;
  select * into a from public.audit_log where id = aid;
  if a.id is null or a.op <> 'DELETE' or a.old is null then raise exception 'Berpa ucun qeyd yoxdur' using errcode = '22023'; end if;
  if a.tbl not in ('appts','expenses','product_sales','breaks','stat_edits','readers') then
    raise exception 'Bunu berpa etmek olmur' using errcode = '22023'; end if;
  rec := jsonb_build_object('id', a.row_id, 'created_at', now(), 'updated_at', now(), 'confirmed', false, 'settled', false,
           'share', 0, 'duration', 90, 'status', 'wait', 'note', '', 'phone', '', 'service', 'Ruqya') || a.old;
  -- rows deleted while the journal kept only part of them: the writer and time come from the journal's INSERT line
  if not (a.old ? 'created_by') then
    select uid, at into iu, iat from public.audit_log where tbl = a.tbl and row_id = a.row_id and op = 'INSERT' order by id limit 1;
    rec := rec || jsonb_strip_nulls(jsonb_build_object('created_by', iu, 'created_at', iat));
  end if;
  execute format('select exists(select 1 from public.%I where id::text = $1)', a.tbl) into ex using a.row_id;
  if ex then raise exception 'Artiq berpa olunub' using errcode = '23505'; end if;
  begin
    execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)', a.tbl, a.tbl) using rec;
  exception when unique_violation or foreign_key_violation then
    if sqlerrm like 'Bu saat%' then raise; end if;
    raise exception 'Bunu berpa etmek olmur: %', sqlerrm using errcode = '22023';
  end;
  return 'ok';
end $$;
revoke all on function public.ruqya_restore(bigint) from public, anon;
grant execute on function public.ruqya_restore(bigint) to authenticated;
select 'OK' as result;

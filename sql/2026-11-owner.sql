-- SUPERSEDED: already applied in production. Do NOT run again — later files (stability, owner, hardening, keep2y, keep2y-b,
-- colors-admin, limits) replaced parts of it, and re-running would bring old rules back.
-- Mərkəz, 2026-11-13: who may change a session, arrival confirmation, restoring deleted data. Safe to run more than once.
-- Undo: rollback-2026-11-owner.sql
-- 1) "Gəlişi təsdiqləyib" (the patient confirmed by WhatsApp): anyone who sees the session may tick it.
alter table public.appts add column if not exists confirmed boolean not null default false;

-- 2) A session is changed or deleted only by an admin or by the person who wrote it.
--    Everybody else may only tick / untick the confirmation.
create or replace function public.ruqya_appt_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null or public.ruqya_is_admin() or current_setting('ruqya.restore', true) = '1' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if old.created_by is not distinct from me then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Yalniz yazan ve admin silir' using errcode = '42501';
  end if;
  if (to_jsonb(new) - array['confirmed','updated_at','created_by','created_at'])
     is distinct from (to_jsonb(old) - array['confirmed','updated_at','created_by','created_at']) then
    raise exception 'Yalniz yazan ve admin deyisir' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.ruqya_appt_owner() from public, anon, authenticated;
drop trigger if exists ruqya_appt_owner on public.appts;
create trigger ruqya_appt_owner before update or delete on public.appts for each row execute function public.ruqya_appt_owner();

-- 3) A sales agent corrects only his own statistics numbers (an admin corrects anyone's).
drop policy if exists ruqya_stat_edits_write on public.stat_edits;
create policy ruqya_stat_edits_write on public.stat_edits for all to authenticated
  using ((select public.ruqya_is_admin()) or ((select public.ruqya_can_stats()) and agent_id = (select auth.uid())::text))
  with check ((select public.ruqya_is_admin()) or ((select public.ruqya_can_stats()) and agent_id = (select auth.uid())::text));

-- 4) The journal keeps the whole row of anything deleted (needed to bring it back).
create or replace function public.ruqya_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare o jsonb; n jsonb; ctx text[]; k text; od jsonb := '{}'; nd jsonb := '{}';
  skip constant text[] := array['updated_at','created_at','created_by','updated_by','id'];
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (uid, tbl, op, row_id, new) values (auth.uid(), tg_table_name, tg_op, new.id::text, to_jsonb(new) - skip);
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (uid, tbl, op, row_id, old) values (auth.uid(), tg_table_name, tg_op, old.id::text, to_jsonb(old));
  else
    o := to_jsonb(old) - skip; n := to_jsonb(new) - skip;
    if o is distinct from n then
      ctx := case tg_table_name
        when 'appts' then array['name','date']
        when 'expenses' then array['title','amount']
        when 'product_sales' then array['amount','date','names']
        when 'readers' then array['name','archived','color']
        when 'staff' then array['name','role']
        when 'breaks' then array['title','start_time','end_time','reader_id']
        when 'stat_edits' then array['agent_id','col','per','period_start','value']
        else array[]::text[] end;
      for k in select key from jsonb_each(n) loop
        if (o -> k) is distinct from (n -> k) or k = any(ctx) then
          od := od || jsonb_build_object(k, o -> k); nd := nd || jsonb_build_object(k, n -> k);
        end if;
      end loop;
      insert into public.audit_log (uid, tbl, op, row_id, old, new) values (auth.uid(), tg_table_name, tg_op, new.id::text, od, nd);
    end if;
  end if;
  if random() < 0.005 then
    delete from public.audit_log where id in (select id from public.audit_log where at < now() - interval '730 days' order by id limit 2000);
  end if;
  return null;
end $$;
revoke all on function public.ruqya_audit() from public, anon, authenticated;

-- 5) The writer and the time of writing come back with a restored row.
create or replace function public.ruqya_stamp() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and coalesce(current_setting('ruqya.restore', true), '') <> '1' then
    if tg_op = 'INSERT' then
      new.created_by := auth.uid();
      new.created_at := now();
    else
      new.created_by := old.created_by;
      new.created_at := old.created_at;
    end if;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    new.created_at := coalesce(new.created_at, now());
  end if;
  if tg_table_name = 'appts' then
    new.updated_at := now();
  end if;
  return new;
end $$;

-- 6) An admin brings a deleted row back from the journal.
create or replace function public.ruqya_restore(aid bigint) returns text
language plpgsql security definer set search_path = public as $$
declare a public.audit_log; rec jsonb; ex boolean;
begin
  if not public.ruqya_is_admin() then raise exception 'Yalniz admin berpa edir' using errcode = '42501'; end if;
  select * into a from public.audit_log where id = aid;
  if a.id is null or a.op <> 'DELETE' or a.old is null then raise exception 'Berpa ucun qeyd yoxdur' using errcode = '22023'; end if;
  if a.tbl not in ('appts','expenses','product_sales','breaks','stat_edits') then
    raise exception 'Bunu berpa etmek olmur' using errcode = '22023'; end if;
  rec := jsonb_build_object('id', a.row_id, 'created_at', now(), 'updated_at', now(), 'confirmed', false, 'settled', false,
           'share', 0, 'duration', 90, 'status', 'wait', 'note', '', 'phone', '', 'service', 'Ruqya') || a.old;
  execute format('select exists(select 1 from public.%I where id::text = $1)', a.tbl) into ex using a.row_id;
  if ex then raise exception 'Artiq berpa olunub' using errcode = '23505'; end if;
  perform set_config('ruqya.restore', '1', true);
  execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)', a.tbl, a.tbl) using rec;
  perform set_config('ruqya.restore', '', true);
  return 'ok';
end $$;
revoke all on function public.ruqya_restore(bigint) from public, anon;
grant execute on function public.ruqya_restore(bigint) to authenticated;
select 'OK' as result;

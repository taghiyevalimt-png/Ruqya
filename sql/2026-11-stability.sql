-- SUPERSEDED: already applied in production. Do NOT run again — later files (stability, owner, hardening, keep2y, keep2y-b,
-- colors-admin, limits) replaced parts of it, and re-running would bring old rules back.
-- Mərkəz, 2026-11-13: smaller journal, faster queries, last privacy holes closed. Safe to run more than once.
-- Undo: rollback-2026-11-stability.sql
-- 1) The double-booking check no longer tells a specialist whether a colleague's time is busy.
alter function public.ruqya_no_overlap() security invoker;
-- 2) Colours: only people with a role (not someone still waiting for approval).
create or replace function public.ruqya_set_color(rid uuid, c text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.staff where id = auth.uid() and role is not null) and not public.ruqya_is_admin() then
    raise exception 'Daxil olmayib' using errcode = '42501'; end if;
  if c is not null and c !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Reng duzgun deyil' using errcode = '23514'; end if;
  update public.readers set color = c where id = rid and color is distinct from c;
end $$;
revoke all on function public.ruqya_set_color(uuid,text) from public, anon;
grant execute on function public.ruqya_set_color(uuid,text) to authenticated;
-- 3) Names: invisible spaces removed; the "same name" rule is checked again when the role or request changes.
create or replace function public.ruqya_staff_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid := 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid; adm boolean;
begin
  if new.name is not null and (tg_op = 'INSERT' or new.name is distinct from old.name) then
    new.name := btrim(regexp_replace(normalize(new.name, NFC), '[[:space:]  ᠎ -‏ -  -⁤　﻿]+', ' ', 'g'));
    if new.name = '' then raise exception 'Adi yazin' using errcode = '23514'; end if;
  end if;
  if auth.uid() is null or auth.uid() = owner then return new; end if;
  adm := public.ruqya_is_admin();
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then raise exception 'Hesab nomresi deyismir' using errcode = '42501'; end if;
    if old.id = owner and (new.name is distinct from old.name or new.role is distinct from old.role) then
      raise exception 'Esas adminin melumati deyismir' using errcode = '42501'; end if;
  end if;
  if new.name is not null and (tg_op = 'INSERT' or new.name is distinct from old.name
                              or new.role is distinct from old.role or new.want is distinct from old.want)
     and exists (select 1 from public.staff s where s.id <> new.id and lower(btrim(s.name)) = lower(new.name)
                 and not (coalesce(new.role, new.want, '') = 'specialist' and coalesce(s.role, '') = 'specialist')) then
    raise exception 'Bu ad artiq var' using errcode = '23505';
  end if;
  if tg_op = 'INSERT' then
    if not adm then new.role := null; end if;
  else
    if new.role is distinct from old.role then
      if not adm then raise exception 'Rolu admin deyisir' using errcode = '42501';
      elsif old.id = auth.uid() and old.role = 'admin' then new.role := old.role; end if;
    end if;
    if not adm and old.role = 'specialist' and new.name is distinct from old.name then
      raise exception 'Mutexessisin adini admin deyisir' using errcode = '42501'; end if;
  end if;
  return new;
end $$;
revoke all on function public.ruqya_staff_guard() from public, anon, authenticated;
-- 4) Two calendar columns can never have the same name (a new "Əli" would otherwise inherit an old Əli's sessions).
create unique index if not exists readers_name_norm on public.readers (lower(btrim(name)));
-- 5) Speed: index for the "written today for earlier days" query; a tiny index for cleaning the journal.
create index if not exists appts_created on public.appts (created_at);
create index if not exists audit_log_at_brin on public.audit_log using brin (at);
drop index if exists public.audit_log_at;
-- 6) Journal about 3 times smaller: a change keeps only what changed (plus the name and date shown on screen).
create or replace function public.ruqya_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare o jsonb; n jsonb; ctx text[]; k text; od jsonb := '{}'; nd jsonb := '{}';
  skip constant text[] := array['updated_at','created_at','created_by','updated_by','id'];
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (uid, tbl, op, row_id, new) values (auth.uid(), tg_table_name, tg_op, new.id::text, to_jsonb(new) - skip);
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (uid, tbl, op, row_id, old) values (auth.uid(), tg_table_name, tg_op, old.id::text, to_jsonb(old) - skip);
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
    delete from public.audit_log where id in (select id from public.audit_log where at < now() - interval '365 days' order by id limit 2000);
  end if;
  return null;
end $$;
revoke all on function public.ruqya_audit() from public, anon, authenticated;
-- 7) Helper functions: nothing for signed-out visitors.
revoke execute on function public.ruqya_sees_all(), public.ruqya_my_readers(), public.ruqya_can_breaks(), public.ruqya_can_stats() from anon;
select 'OK' as result;

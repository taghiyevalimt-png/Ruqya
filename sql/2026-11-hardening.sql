-- Mərkəz, 2026-11-14: hardening after the second independent review. Safe to run more than once.
-- 1) Restoring no longer relies on a setting a database session could set itself (ruqya_stamp trusts the caller role instead).
-- 2) The confirmation tick is refused on cancelled / no-show / long-past sessions (for people who did not write them).
-- 3) Someone still waiting for a role no longer sees the staff list or the breaks (only his own staff row).
create or replace function public.ruqya_appt_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null or public.ruqya_is_admin() or old.created_by is not distinct from me then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Yalniz yazan ve admin silir' using errcode = '42501';
  end if;
  if (to_jsonb(new) - array['confirmed','updated_at','created_by','created_at'])
     is distinct from (to_jsonb(old) - array['confirmed','updated_at','created_by','created_at']) then
    raise exception 'Yalniz yazan ve admin deyisir' using errcode = '42501';
  end if;
  if new.confirmed is distinct from old.confirmed
     and (old.status in ('cancel','noshow') or old.date < (now() at time zone 'Asia/Baku')::date - 1) then
    raise exception 'Bu qebulu tesdiqlemek olmur' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.ruqya_appt_owner() from public, anon, authenticated;
create or replace function public.ruqya_stamp() returns trigger
language plpgsql set search_path = public as $$
begin
  -- app users (PostgREST runs as anon/authenticated): the server decides writer and time.
  -- Inside ruqya_restore (SECURITY DEFINER) current_user is the owner, so the journal's values stay.
  if auth.uid() is not null and current_user in ('authenticated', 'anon') then
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
revoke all on function public.ruqya_stamp() from public, anon, authenticated;

create or replace function public.ruqya_restore(aid bigint) returns text
language plpgsql security definer set search_path = public as $$
declare a public.audit_log; rec jsonb; ex boolean; iu uuid; iat timestamptz;
begin
  if not public.ruqya_is_admin() then raise exception 'Yalniz admin berpa edir' using errcode = '42501'; end if;
  select * into a from public.audit_log where id = aid;
  if a.id is null or a.op <> 'DELETE' or a.old is null then raise exception 'Berpa ucun qeyd yoxdur' using errcode = '22023'; end if;
  if a.tbl not in ('appts','expenses','product_sales','breaks','stat_edits') then
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
  execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)', a.tbl, a.tbl) using rec;
  return 'ok';
end $$;
revoke all on function public.ruqya_restore(bigint) from public, anon;
grant execute on function public.ruqya_restore(bigint) to authenticated;
create or replace function public.ruqya_has_role() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.ruqya_is_admin() or exists (select 1 from public.staff where id = auth.uid() and role is not null), false) $$;
revoke all on function public.ruqya_has_role() from public, anon;
grant execute on function public.ruqya_has_role() to authenticated;
drop policy if exists "read staff" on public.staff;
create policy "read staff" on public.staff for select to authenticated using (id = (select auth.uid()) or (select public.ruqya_has_role()));
-- readers stay visible: the "Mən kiməm" sheet of a pending specialist picks his column from them.
drop policy if exists "read breaks" on public.breaks;
create policy "read breaks" on public.breaks for select to authenticated using ((select public.ruqya_has_role()));
select 'OK' as result;

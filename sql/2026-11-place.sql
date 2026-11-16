-- 2026-11-17: where the session takes place (Ofis / Onlayn / Ünvan, default Ofis) and the phone field takes any text.
-- Adds appts.place (existing bookings become "ofis") and updates the booking rules from 2026-11-rules.sql:
-- the phone must not be empty (letters allowed), the place must be one of the three.
-- Needs 2026-11-rules.sql. Safe to run again. Rollback: sql/rollback-2026-11-place.sql

alter table public.appts add column if not exists place text not null default 'ofis';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ruqya_appts_place') then
    alter table public.appts add constraint ruqya_appts_place check (place in ('ofis','onlayn','unvan'));
  end if;
end $$;
create or replace function public.ruqya_appt_rules() returns trigger
language plpgsql set search_path = public as $$
declare s int; d int;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' or new.name is distinct from old.name then
    if btrim(coalesce(new.name, '')) = '' then raise exception 'Qayda: ad bos' using errcode = '23514'; end if;
  end if;
  if (tg_op = 'INSERT' or new.phone is distinct from old.phone) and btrim(coalesce(new.phone, '')) = ''
     and new.name is distinct from 'Anonim' then
    raise exception 'Qayda: telefon' using errcode = '23514'; end if;
  if (tg_op = 'INSERT' or new.place is distinct from old.place) and coalesce(new.place, '') not in ('ofis','onlayn','unvan') then
    raise exception 'Qayda: yer' using errcode = '23514'; end if;
  if tg_op = 'INSERT' or new.price is distinct from old.price then
    if new.price is null or new.price <= 0 then raise exception 'Qayda: qiymet' using errcode = '23514'; end if;
  end if;
  if tg_op = 'INSERT' or new.time::text is distinct from old.time::text or new.duration is distinct from old.duration then
    d := coalesce(new.duration, 90);
    s := split_part(new.time::text, ':', 1)::int * 60 + split_part(new.time::text, ':', 2)::int;
    if d < 30 or d > 180 then raise exception 'Qayda: muddet' using errcode = '23514'; end if;
    if s < 480 or s + d > 1440 then raise exception 'Qayda: saat' using errcode = '23514'; end if;
  end if;
  return new;
end $$;
revoke all on function public.ruqya_appt_rules() from public, anon, authenticated;
drop trigger if exists ruqya_appt_rules on public.appts;
create trigger ruqya_appt_rules before insert or update on public.appts for each row execute function public.ruqya_appt_rules();
-- restoring a booking deleted before the place column existed: it comes back as "ofis"
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
           'share', 0, 'duration', 90, 'status', 'wait', 'note', '', 'phone', '', 'service', 'Ruqya', 'place', 'ofis') || a.old;
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

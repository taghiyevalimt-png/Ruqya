-- Undo of 2026-11-a6-private-helpers.sql: the seven helpers go back to schema public and every function that calls
-- them is restored to its previous text (taken from the database before the migration).
-- Order: roll back 2026-11-a6-one-policy.sql FIRST (its policies call private.*), then this file.
do $$ declare f text; begin
  foreach f in array array['ruqya_is_admin()','ruqya_has_role()','ruqya_sees_all()','ruqya_my_readers()','ruqya_can_stats()','ruqya_can_breaks()','ruqya_err_ok()'] loop
    if to_regprocedure('private.' || f) is not null then execute 'alter function private.' || f || ' set schema public'; end if;
  end loop;
end $$;
CREATE OR REPLACE FUNCTION public.ruqya_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(auth.uid() = 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid
    or exists (select 1 from public.staff where id = auth.uid() and role = 'admin'), false)
$function$;

CREATE OR REPLACE FUNCTION public.ruqya_has_role()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(public.ruqya_is_admin() or exists (select 1 from public.staff where id = auth.uid() and role is not null), false) $function$;

CREATE OR REPLACE FUNCTION public.ruqya_sees_all()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(public.ruqya_is_admin() or exists (select 1 from public.staff where id = auth.uid() and role = 'agent'), false)
$function$;

CREATE OR REPLACE FUNCTION public.ruqya_my_readers()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.id from public.readers r join public.staff s
    on s.id = auth.uid() and s.role = 'specialist' and lower(btrim(r.name)) = lower(btrim(s.name))
$function$;

CREATE OR REPLACE FUNCTION public.ruqya_can_stats()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(public.ruqya_is_admin() or exists (select 1 from public.staff where id = auth.uid() and role = 'agent'), false) $function$;

CREATE OR REPLACE FUNCTION public.ruqya_can_breaks()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(public.ruqya_is_admin() or exists (select 1 from public.staff where id = auth.uid() and role = 'agent'), false) $function$;

CREATE OR REPLACE FUNCTION public.ruqya_err_ok()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select (select count(*) from public.app_errors where uid = auth.uid() and at > now() - interval '1 hour') < 100 $function$;

CREATE OR REPLACE FUNCTION public.ruqya_appt_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid();
begin
  if tg_op = 'UPDATE' and coalesce(new.follow, 0) is distinct from coalesce(old.follow, 0)
     and old.status not in ('cancel','noshow') and new.status not in ('cancel','noshow') then
    raise exception 'Xatirlatma yalniz legv olunana' using errcode = '42501';
  end if;
  if me is null or public.ruqya_is_admin() or old.created_by is not distinct from me then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Yalniz yazan ve admin silir' using errcode = '42501';
  end if;
  if (to_jsonb(new) - array['confirmed','follow','settled','updated_at','created_by','created_at'])
     is distinct from (to_jsonb(old) - array['confirmed','follow','settled','updated_at','created_by','created_at']) then
    raise exception 'Yalniz yazan ve admin deyisir' using errcode = '42501';
  end if;
  if new.confirmed is distinct from old.confirmed
     and (old.status in ('cancel','noshow') or old.date < (now() at time zone 'Asia/Baku')::date - 1) then
    raise exception 'Bu qebulu tesdiqlemek olmur' using errcode = '42501';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.ruqya_staff_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare owner uuid := 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid; adm boolean;
begin
  if new.name is not null and (tg_op = 'INSERT' or new.name is distinct from old.name) then
    new.name := btrim(regexp_replace(normalize(new.name, NFC), '[[:space:]\u00a0\u1680\u180e\u2000-\u200f\u2028-\u202f\u205f-\u2064\u3000\ufeff]+', ' ', 'g'));
    if new.name = '' then raise exception 'Adi yazin' using errcode = '23514'; end if;
  end if;
  if auth.uid() is null or auth.uid() = owner then return new; end if;
  adm := public.ruqya_is_admin();
  -- owner 18.11: only an admin decides who is kept out of the statistics
  if not adm and (case when tg_op = 'INSERT' then coalesce(new.hide_stats, false) else new.hide_stats is distinct from old.hide_stats end) then
    raise exception 'Statistikani admin deyisir' using errcode = '42501';
  end if;
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
end $function$;

CREATE OR REPLACE FUNCTION public.ruqya_throttle()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.ruqya_set_color(rid uuid, c text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.ruqya_is_admin() then raise exception 'Rengi admin deyisir' using errcode = '42501'; end if;
  if c is not null and c !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Reng duzgun deyil' using errcode = '23514'; end if;
  update public.readers set color = c where id = rid and color is distinct from c;
end $function$;

CREATE OR REPLACE FUNCTION public.ruqya_anonymize(key text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare ids text[]; n int; t0 timestamptz := now();
begin
  if not public.ruqya_is_admin() then raise exception 'Yalniz admin anonimlesdirir' using errcode = '42501'; end if;
  if key is null or length(key) < 2 then raise exception 'Pasiyent yoxdur' using errcode = '22023'; end if;
  select array_agg(id::text) into ids from public.appts where public.ruqya_pkey(phone, name) = key;
  ids := coalesce(ids, '{}') || coalesce((select array_agg(distinct row_id) from public.audit_log
    where tbl = 'appts' and op = 'DELETE' and public.ruqya_pkey(old->>'phone', old->>'name') = key), '{}');
  n := coalesce(array_length(ids, 1), 0);
  if n = 0 then raise exception 'Pasiyent yoxdur' using errcode = '22023'; end if;
  update public.appts set name = 'Anonim', phone = '', note = '' where id::text = any(ids);
  delete from public.audit_log where tbl = 'appts' and op = 'UPDATE' and row_id = any(ids) and at >= t0;
  update public.audit_log set old = public.ruqya_scrub(old), new = public.ruqya_scrub(new) where tbl = 'appts' and row_id = any(ids);
  insert into public.audit_log (uid, tbl, op, row_id, new) values (auth.uid(), 'appts', 'ANON', null, jsonb_build_object('count', n));
  return n;
end $function$;

CREATE OR REPLACE FUNCTION public.ruqya_restore(aid bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.audit_log; rec jsonb; ex boolean; iu uuid; iat timestamptz;
begin
  if not public.ruqya_is_admin() then raise exception 'Yalniz admin berpa edir' using errcode = '42501'; end if;
  select * into a from public.audit_log where id = aid;
  if a.id is null or a.op <> 'DELETE' or a.old is null then raise exception 'Berpa ucun qeyd yoxdur' using errcode = '22023'; end if;
  if a.tbl not in ('appts','expenses','product_sales','breaks','stat_edits','readers') then
    raise exception 'Bunu berpa etmek olmur' using errcode = '22023'; end if;
  rec := jsonb_build_object('id', a.row_id, 'created_at', now(), 'updated_at', now(), 'confirmed', false, 'settled', false,
           'share', 0, 'duration', 90, 'status', 'wait', 'note', '', 'phone', '', 'service', 'Ruqya', 'place', 'ofis') || a.old;
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
end $function$;

CREATE OR REPLACE FUNCTION private.ruqya_visit_ids(key text, before date, since date)
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(array_agg(s.id), '{}') from (
    select a.id from public.appts a
     where public.ruqya_pkey(a.phone, a.name) = key
       and a.date >= greatest(since, current_date - 800) and a.date < before
       -- the same rule as the read policies of appts (ruqya_appts_read, ruqya_no_anonymous): even called by direct
       -- SQL it gives out only ids of rows the caller may read (stage 7 pentest F-1)
       and (public.ruqya_sees_all() or a.reader_id in (select public.ruqya_my_readers()))
       and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
     order by a.date desc, a.id limit 500) s $function$;

alter policy ruqya_err_insert on public.app_errors with check
  ((uid = auth.uid()) and (coalesce((((select auth.jwt()) ->> 'is_anonymous'))::boolean, false) = false) and (select public.ruqya_err_ok()));
-- the schema stays (private.ruqya_visit_ids of 2026-11-patients-scale.sql lives there); signed-in users no longer
-- need to use it directly, as before this migration
revoke usage on schema private from authenticated, service_role;
select 'OK' as result;

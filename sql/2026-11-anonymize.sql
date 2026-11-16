-- Removing a patient's personal data on request (audit F-02). Admins only.
-- Name, phone and note are wiped in every booking of the patient and in every copy of those bookings in the
-- change journal; the sessions themselves stay, so statistics and money totals do not change.
-- The journal keeps one line "who did it, how many bookings", without the patient's data.
-- Needs 2026-11-patients.sql (ruqya_pkey). Safe to run again. Rollback: sql/rollback-2026-11-anonymize.sql
-- (the rollback only removes the function; wiped data cannot come back).

create or replace function public.ruqya_scrub(j jsonb) returns jsonb
language sql immutable set search_path = public as $$
  select case when j is null then null else
    j || jsonb_strip_nulls(jsonb_build_object(
      'name',  case when j ? 'name'  then to_jsonb('Anonim'::text) end,
      'phone', case when j ? 'phone' then to_jsonb(''::text) end,
      'note',  case when j ? 'note'  then to_jsonb(''::text) end))
  end $$;

create or replace function public.ruqya_anonymize(key text) returns int
language plpgsql security definer set search_path = public as $$
declare ids text[]; n int; t0 timestamptz := now();
begin
  if not public.ruqya_is_admin() then raise exception 'Yalniz admin anonimlesdirir' using errcode = '42501'; end if;
  if key is null or length(key) < 2 then raise exception 'Pasiyent yoxdur' using errcode = '22023'; end if;
  select array_agg(id::text) into ids from public.appts where public.ruqya_pkey(phone, name) = key;
  -- bookings already deleted: only their journal copies are left
  ids := coalesce(ids, '{}') || coalesce((select array_agg(distinct row_id) from public.audit_log
           where tbl = 'appts' and op = 'DELETE' and public.ruqya_pkey(old->>'phone', old->>'name') = key), '{}');
  n := coalesce(array_length(ids, 1), 0);
  if n = 0 then raise exception 'Pasiyent yoxdur' using errcode = '22023'; end if;
  update public.appts set name = 'Anonim', phone = '', note = '' where id::text = any(ids);
  -- the journal lines written just now by that update hold the old values: they go, and so do all older copies
  delete from public.audit_log where tbl = 'appts' and op = 'UPDATE' and row_id = any(ids) and at >= t0;
  update public.audit_log set old = public.ruqya_scrub(old), new = public.ruqya_scrub(new)
   where tbl = 'appts' and row_id = any(ids);
  insert into public.audit_log (uid, tbl, op, row_id, new) values (auth.uid(), 'appts', 'ANON', null, jsonb_build_object('count', n));
  return n;
end $$;

revoke all on function public.ruqya_scrub(jsonb) from public, anon, authenticated;
revoke all on function public.ruqya_anonymize(text) from public, anon;
grant execute on function public.ruqya_anonymize(text) to authenticated;
select 'OK' as result;

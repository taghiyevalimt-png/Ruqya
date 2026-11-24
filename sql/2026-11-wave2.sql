-- Mərkəz (24.11, owner — wave 2): patient marks and merging duplicates.
--  ruqya_patient_marks(min_vip)  — the patient keys (ruqya_pkey: last 9 digits of the phone + the folded name, as in the
--     app) that are VIP (at least min_vip visits that were not cancelled, up to today, Baku time) and/or have a booking
--     written by the caller («Mənim pasiyentlərim»). Only rows the caller may read are counted (security invoker,
--     row level security applies), the last 800 days like the patients' history. Small answer: only marked keys.
--  ruqya_merge_patients(keys, name) — admin only: every booking of the given patient keys gets this name (a duplicate
--     made by a typo: the same number, the name written differently). The phone stays. Each changed row goes to the
--     audit log as usual. Returns the number of bookings changed.
-- No table changes. Safe to run again. Undo: rollback-2026-11-wave2.sql
create or replace function public.ruqya_patient_marks(min_vip integer default 5)
returns table(k text, vip boolean, mine boolean)
language plpgsql stable security invoker set search_path = public as $f$
declare me uuid := auth.uid(); d date := (now() at time zone 'Asia/Baku')::date; m int := greatest(coalesce(min_vip, 5), 2);
begin
  if me is null then return; end if;
  return query
  select x.k, x.n >= m, x.my from (
    select public.ruqya_pkey(a.phone, a.name) k,
           count(*) filter (where a.status not in ('cancel','noshow') and a.date <= d) n,
           coalesce(bool_or(a.created_by = me), false) my
      from public.appts a
     where a.date >= d - 800
     group by 1) x
   where x.n >= m or x.my;
end $f$;
revoke all on function public.ruqya_patient_marks(integer) from public, anon;
grant execute on function public.ruqya_patient_marks(integer) to authenticated;

create or replace function public.ruqya_merge_patients(keys text[], p_name text)
returns integer
language plpgsql volatile security invoker set search_path = public as $f$
declare nm text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')); n int;
begin
  if not (select private.ruqya_is_admin()) then raise exception 'Yalniz admin birlesdirir' using errcode = '42501'; end if;
  if nm = '' or length(nm) > 80 then raise exception 'Ad duzgun deyil' using errcode = '22023'; end if;
  if keys is null or cardinality(keys) < 1 or cardinality(keys) > 20 then raise exception 'Acar sayi duzgun deyil' using errcode = '22023'; end if;
  -- only keys of one phone number (a duplicate is the same number with another name)
  if (select count(distinct split_part(x, '|', 1)) from unnest(keys) x) <> 1 or exists (select 1 from unnest(keys) x where x !~ '^p[0-9]{7,9}\|') then
    raise exception 'Yalniz eyni nomre birlesdirilir' using errcode = '22023'; end if;
  update public.appts a set name = nm
   where public.ruqya_pkey(a.phone, a.name) = any(keys) and a.name is distinct from nm;
  get diagnostics n = row_count;
  return n;
end $f$;
revoke all on function public.ruqya_merge_patients(text[], text) from public, anon;
grant execute on function public.ruqya_merge_patients(text[], text) to authenticated;
select 'OK' as result;

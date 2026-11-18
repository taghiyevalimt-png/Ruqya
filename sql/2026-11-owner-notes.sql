-- Owner 18.11 (list of notes):
--  1. Breaks on chosen days, like a calendar: days of the week (1 = Monday … 7 = Sunday, empty = every day) and a
--     date range (empty = no limit; one day = the same date twice). Old breaks keep working every day.
--  2. Specialists may add, change and delete the breaks of their own column (not the shared ones, not other
--     columns) — the same rule that decides which bookings a specialist sees (ruqya_my_readers).
--  3. An admin can keep chosen sales agents out of the statistics: staff.hide_stats. Only an admin may change it
--     (also not the agent himself through his own row).
-- Safe to run again. Rollback: sql/rollback-2026-11-owner-notes.sql

-- 1
alter table public.breaks add column if not exists days smallint[];
alter table public.breaks add column if not exists date_from date;
alter table public.breaks add column if not exists date_to date;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'breaks_days_ok') then
    alter table public.breaks add constraint breaks_days_ok check (days is null or (days <@ array[1,2,3,4,5,6,7]::smallint[] and cardinality(days) between 1 and 7));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'breaks_dates_ok') then
    alter table public.breaks add constraint breaks_dates_ok check (date_from is null or date_to is null or date_to >= date_from);
  end if;
end $$;

-- 2
drop policy if exists ruqya_breaks_specialist on public.breaks;
create policy ruqya_breaks_specialist on public.breaks for all to authenticated
  using (reader_id is not null and reader_id in (select public.ruqya_my_readers()))
  with check (reader_id is not null and reader_id in (select public.ruqya_my_readers()));

-- 3
alter table public.staff add column if not exists hide_stats boolean not null default false;
create or replace function public.ruqya_staff_guard() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
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

select 'OK' as result;

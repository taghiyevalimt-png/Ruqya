-- Ruqyatz, second audit 2026-11-13. Safe to run more than once. Changes no stored data.
-- Run once in Supabase -> SQL Editor (after 2026-11-audit.sql). To undo: rollback-2026-11-audit2.sql.
--
-- 1) Staff records: a person can no longer delete their own record, switch their own role once it is set
--    (the admin does that in Ayarlar), take the same name as a colleague (two accounts of one specialist may share it),
--    or have their account id changed.
--    Nobody but the main admin can change the main admin's record.
-- 2) Bookings: the server refuses a time that is not HH:MM (00:00-23:59) or a date outside 2020-2099,
--    so the double-booking check can no longer be skipped with a time like " 10:00".
-- 3) Every table refuses "anonymous sign-in" accounts, in case that Supabase switch is ever turned on.

-- 1) staff
drop policy if exists "own staff" on public.staff;
drop policy if exists "own staff insert" on public.staff;
drop policy if exists "own staff update" on public.staff;
create policy "own staff insert" on public.staff for insert to authenticated with check (id = (select auth.uid()));
create policy "own staff update" on public.staff for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create or replace function public.ruqya_staff_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid := 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid; adm boolean;
begin
  if auth.uid() is null or auth.uid() = owner then return new; end if;   -- SQL Editor and the main admin
  adm := public.ruqya_is_admin();
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'Hesab nomresi deyismir' using errcode = '42501';
    end if;
    if old.id = owner and (new.name is distinct from old.name or new.role is distinct from old.role) then
      raise exception 'Esas adminin melumati deyismir' using errcode = '42501';
    end if;
  end if;
  -- a name another employee already has is refused (only when the name is set or changed; two accounts of the
  -- same specialist may share the specialist's name)
  if new.name is not null and (tg_op = 'INSERT' or new.name is distinct from old.name)
     and exists (select 1 from public.staff s where s.id <> new.id and lower(btrim(s.name)) = lower(btrim(new.name))
                 and not (coalesce(new.role, '') = 'specialist' and coalesce(s.role, '') = 'specialist')) then
    raise exception 'Bu ad artiq var' using errcode = '23505';
  end if;
  if tg_op = 'INSERT' then
    if new.role = 'admin' and not adm then new.role := 'agent'; end if;
  elsif new.role is distinct from old.role then
    if (new.role = 'admin' or old.role = 'admin') and not adm then new.role := old.role;
    elsif old.id = auth.uid() and old.role = 'admin' then new.role := old.role;  -- an admin cannot drop his own admin role
    elsif old.id = auth.uid() and old.role is not null and not adm then
      raise exception 'Rolu admin deyisir' using errcode = '42501';            -- a set role is changed by an admin
    end if;
  end if;
  return new;
end $$;
revoke all on function public.ruqya_staff_guard() from public;

-- 2) appts: well-formed time and date only; the overlap check never skips a row.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ruqya_appts_time') then
    alter table public.appts add constraint ruqya_appts_time check (time::text ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ruqya_appts_date') then
    alter table public.appts add constraint ruqya_appts_date check (date between '2020-01-01' and '2099-12-31') not valid;
  end if;
end $$;
-- Existing rows are checked too; if one does not fit, this line stops with its error and nothing above is lost.
alter table public.appts validate constraint ruqya_appts_time;
alter table public.appts validate constraint ruqya_appts_date;

create or replace function public.ruqya_no_overlap() returns trigger
language plpgsql security definer set search_path = public as $$
declare s integer; e integer;
begin
  if new.status = 'cancel' then return new; end if;
  if tg_op = 'UPDATE' and old.status <> 'cancel' and new.reader_id is not distinct from old.reader_id and new.date is not distinct from old.date
     and new.time::text is not distinct from old.time::text and coalesce(new.duration, 90) = coalesce(old.duration, 90) then return new; end if;
  s := public.ruqya_min(new.time::text);
  if s is null then raise exception 'Saat duzgun deyil' using errcode = '23514'; end if;
  if new.reader_id is null or new.date is null then return new; end if;
  e := s + coalesce(new.duration, 90);
  perform pg_advisory_xact_lock(hashtextextended(new.reader_id::text || '|' || new.date::text, 0));
  if exists (select 1 from public.appts a where a.reader_id = new.reader_id and a.date = new.date and a.status <> 'cancel' and a.id <> new.id
      and public.ruqya_min(a.time::text) < e and public.ruqya_min(a.time::text) + coalesce(a.duration, 90) > s) then
    raise exception 'Bu saat artiq tutulub' using errcode = '23505';
  end if;
  return new;
end $$;
revoke all on function public.ruqya_no_overlap() from public;

-- 3) no anonymous sign-in accounts anywhere (a restrictive rule is added on top of every existing rule)
do $$ declare t text; begin
  foreach t in array array['appts','expenses','product_sales','staff','readers','breaks','services','audit_log'] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop policy if exists ruqya_no_anonymous on public.%I', t);
      execute format('create policy ruqya_no_anonymous on public.%I as restrictive for all to authenticated using (coalesce(((select auth.jwt()) ->> ''is_anonymous'')::boolean, false) = false) with check (coalesce(((select auth.jwt()) ->> ''is_anonymous'')::boolean, false) = false)', t);
    end if;
  end loop;
end $$;

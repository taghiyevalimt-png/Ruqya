-- Ruqyatz: protection of the data inside the database itself.
-- Safe to run more than once. Changes no existing rows and deletes nothing.

-- 1. Helper: "HH:MM" as minutes; anything unreadable gives NULL instead of an error.
create or replace function public.ruqya_min(t text) returns integer
language sql immutable as $$
  select case when t ~ '^[0-9]{1,2}:[0-9]{2}'
    then split_part(t, ':', 1)::int * 60 + left(split_part(t, ':', 2), 2)::int end
$$;

alter table public.appts add column if not exists duration integer default 90;

-- 2. Every booking remembers when it was last changed (lets phones catch up cheaply).
alter table public.appts add column if not exists updated_at timestamptz not null default now();

-- 3. The author and the creation time of a record cannot be faked or changed from a phone.
create or replace function public.ruqya_stamp() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.created_by := auth.uid();
      new.created_at := now();
    else
      new.created_by := old.created_by;
      new.created_at := old.created_at;
    end if;
  end if;
  if tg_table_name = 'appts' then
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists ruqya_stamp on public.appts;
create trigger ruqya_stamp before insert or update on public.appts
  for each row execute function public.ruqya_stamp();
drop trigger if exists ruqya_stamp on public.expenses;
create trigger ruqya_stamp before insert or update on public.expenses
  for each row execute function public.ruqya_stamp();
drop trigger if exists ruqya_stamp on public.product_sales;
create trigger ruqya_stamp before insert or update on public.product_sales
  for each row execute function public.ruqya_stamp();

-- 4. Two phones can never book the same specialist for overlapping time,
--    even if both press "Yaz" in the same second.
create or replace function public.ruqya_no_overlap() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s integer;
  e integer;
begin
  if new.status = 'cancel' then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.status <> 'cancel'
     and new.reader_id is not distinct from old.reader_id
     and new.date is not distinct from old.date
     and new.time::text is not distinct from old.time::text
     and coalesce(new.duration, 90) = coalesce(old.duration, 90) then
    return new;
  end if;
  s := public.ruqya_min(new.time::text);
  if s is null or new.reader_id is null or new.date is null then
    return new;
  end if;
  e := s + coalesce(new.duration, 90);
  perform pg_advisory_xact_lock(hashtextextended(new.reader_id::text || '|' || new.date::text, 0));
  if exists (
    select 1 from public.appts a
    where a.reader_id = new.reader_id
      and a.date = new.date
      and a.status <> 'cancel'
      and a.id <> new.id
      and public.ruqya_min(a.time::text) < e
      and public.ruqya_min(a.time::text) + coalesce(a.duration, 90) > s
  ) then
    raise exception 'Bu saat artiq tutulub' using errcode = '23505';
  end if;
  return new;
end $$;

drop trigger if exists ruqya_no_overlap on public.appts;
create trigger ruqya_no_overlap before insert or update on public.appts
  for each row execute function public.ruqya_no_overlap();

-- 5. Limits against typing mistakes and abuse. Existing rows are not re-checked.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ruqya_appts_price') then
    alter table public.appts add constraint ruqya_appts_price
      check (price is null or (price >= 0 and price <= 1000000)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ruqya_appts_duration') then
    alter table public.appts add constraint ruqya_appts_duration
      check (duration is null or (duration >= 5 and duration <= 960)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ruqya_appts_text') then
    alter table public.appts add constraint ruqya_appts_text
      check (char_length(coalesce(name, '')) <= 200
         and char_length(coalesce(phone, '')) <= 60
         and char_length(coalesce(note, '')) <= 2000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ruqya_expenses_amount') then
    alter table public.expenses add constraint ruqya_expenses_amount
      check (amount is null or (amount >= 0 and amount <= 1000000)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ruqya_expenses_text') then
    alter table public.expenses add constraint ruqya_expenses_text
      check (char_length(coalesce(title, '')) <= 300) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ruqya_products_amount') then
    alter table public.product_sales add constraint ruqya_products_amount
      check (amount is null or (amount >= 0 and amount <= 1000000)) not valid;
  end if;
end $$;

-- 6. Admins. The owner is always an admin and is the only one who can give
--    the admin role to another account or take it back.
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.staff'::regclass and contype = 'c'
             and conname <> 'ruqya_staff_role'
             and pg_get_constraintdef(oid) ilike '%role%' loop
    execute format('alter table public.staff drop constraint %I', c.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'ruqya_staff_role') then
    alter table public.staff add constraint ruqya_staff_role
      check (role is null or role in ('agent', 'specialist', 'admin')) not valid;
  end if;
end $$;

create or replace function public.ruqya_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.uid() = 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid
    or exists (select 1 from public.staff where id = auth.uid() and role = 'admin'), false)
$$;

create or replace function public.ruqya_staff_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth.uid() = 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.role = 'admin' then new.role := 'agent'; end if;
  elsif new.role is distinct from old.role and (new.role = 'admin' or old.role = 'admin') then
    new.role := old.role;
  end if;
  return new;
end $$;
drop trigger if exists ruqya_staff_guard on public.staff;
create trigger ruqya_staff_guard before insert or update on public.staff
  for each row execute function public.ruqya_staff_guard();

drop policy if exists ruqya_staff_owner on public.staff;
drop policy if exists ruqya_staff_admin on public.staff;
create policy ruqya_staff_admin on public.staff for update to authenticated
  using (public.ruqya_is_admin()) with check (public.ruqya_is_admin());
drop policy if exists ruqya_readers_admin on public.readers;
create policy ruqya_readers_admin on public.readers for all to authenticated
  using (public.ruqya_is_admin()) with check (public.ruqya_is_admin());
drop policy if exists ruqya_breaks_admin on public.breaks;
create policy ruqya_breaks_admin on public.breaks for all to authenticated
  using (public.ruqya_is_admin()) with check (public.ruqya_is_admin());
update public.staff set role = 'admin' where id = 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid and role is distinct from 'admin';

-- 7. Journal of every change: who added, changed or deleted what, and when.
--    Only admins can read it; nobody can edit or erase it from a phone.
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  uid uuid,
  tbl text not null,
  op text not null,
  row_id text,
  old jsonb,
  new jsonb
);
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
drop policy if exists ruqya_audit_owner on public.audit_log;
create policy ruqya_audit_owner on public.audit_log for select to authenticated
  using (public.ruqya_is_admin());

create or replace function public.ruqya_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (uid, tbl, op, row_id, new)
      values (auth.uid(), tg_table_name, tg_op, new.id::text, to_jsonb(new));
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (uid, tbl, op, row_id, old)
      values (auth.uid(), tg_table_name, tg_op, old.id::text, to_jsonb(old));
  elsif (to_jsonb(old) - 'updated_at') is distinct from (to_jsonb(new) - 'updated_at') then
    insert into public.audit_log (uid, tbl, op, row_id, old, new)
      values (auth.uid(), tg_table_name, tg_op, new.id::text, to_jsonb(old), to_jsonb(new));
  end if;
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['appts', 'expenses', 'product_sales', 'readers', 'breaks', 'staff'] loop
    execute format('drop trigger if exists ruqya_audit on public.%I', t);
    execute format('create trigger ruqya_audit after insert or update or delete on public.%I for each row execute function public.ruqya_audit()', t);
  end loop;
end $$;

-- 8. These helper functions are for the database only, not callable from outside.
revoke execute on function public.ruqya_audit() from public, anon, authenticated;
revoke execute on function public.ruqya_no_overlap() from public, anon, authenticated;
revoke execute on function public.ruqya_stamp() from public, anon, authenticated;
revoke execute on function public.ruqya_staff_guard() from public, anon, authenticated;

select 'Hazirdir' as netice;

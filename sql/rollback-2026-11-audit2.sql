-- Undo sql/2026-11-audit2.sql: puts back exactly the rules that were live before it. Safe to run more than once.
drop policy if exists "own staff insert" on public.staff;
drop policy if exists "own staff update" on public.staff;
drop policy if exists "own staff" on public.staff;
create policy "own staff" on public.staff for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create or replace function public.ruqya_staff_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth.uid() = 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid then return new; end if;
  if tg_op = 'INSERT' then
    if new.role = 'admin' and not public.ruqya_is_admin() then new.role := 'agent'; end if;
  elsif new.role is distinct from old.role then
    if old.id = 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid then new.role := old.role;
    elsif (new.role = 'admin' or old.role = 'admin') and not public.ruqya_is_admin() then new.role := old.role;
    elsif old.id = auth.uid() and old.role = 'admin' then new.role := old.role;
    end if;
  end if;
  return new;
end $$;
create or replace function public.ruqya_no_overlap() returns trigger language plpgsql security definer set search_path = public as $$
declare s integer; e integer;
begin
  if new.status = 'cancel' then return new; end if;
  if tg_op = 'UPDATE' and old.status <> 'cancel' and new.reader_id is not distinct from old.reader_id and new.date is not distinct from old.date
     and new.time::text is not distinct from old.time::text and coalesce(new.duration, 90) = coalesce(old.duration, 90) then return new; end if;
  s := public.ruqya_min(new.time::text);
  if s is null or new.reader_id is null or new.date is null then return new; end if;
  e := s + coalesce(new.duration, 90);
  perform pg_advisory_xact_lock(hashtextextended(new.reader_id::text || '|' || new.date::text, 0));
  if exists (select 1 from public.appts a where a.reader_id = new.reader_id and a.date = new.date and a.status <> 'cancel' and a.id <> new.id
      and public.ruqya_min(a.time::text) < e and public.ruqya_min(a.time::text) + coalesce(a.duration, 90) > s) then
    raise exception 'Bu saat artiq tutulub' using errcode = '23505';
  end if;
  return new;
end $$;
revoke all on function public.ruqya_staff_guard(), public.ruqya_no_overlap() from public;
alter table public.appts drop constraint if exists ruqya_appts_time;
alter table public.appts drop constraint if exists ruqya_appts_date;
do $$ declare t text; begin
  foreach t in array array['appts','expenses','product_sales','staff','readers','breaks','services','audit_log'] loop
    if to_regclass('public.'||t) is not null then execute format('drop policy if exists ruqya_no_anonymous on public.%I', t); end if;
  end loop;
end $$;

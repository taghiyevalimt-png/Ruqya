-- Mərkəz, 2026-11-13: privacy of specialists, product names, three "Müraciət" numbers.
-- Safe to run more than once. Undo: rollback-2026-11-privacy.sql
-- The only stored change: people who never got a role (empty) keep working as sales agents, as they do today
-- (an admin can change any role in Ayarlar). Everyone who registers from now on waits for an admin.
--
-- 1) A specialist sees, writes and changes ONLY the sessions of his own calendar column
--    (the column whose name is his name). Sales agents and admins see everything, as before.
--    A specialist does not see Kassa (expenses, product sales) or the statistics corrections.
-- 2) Roles are given by an admin only. A new person only says who he is ("want"); until an admin
--    gives the role (Ayarlar), he sees no sessions at all. Nobody can make himself a sales agent or admin.
--    A specialist cannot rename himself (the name is what ties him to his column); an admin can.
-- 3) Product sales get a "names" field (what was sold).
-- 4) Statistics corrections may hold "Müraciət WP" (w) and "Müraciət SŞ" (s).

-- 3) product names
alter table public.product_sales add column if not exists names text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ruqya_products_names') then
    alter table public.product_sales add constraint ruqya_products_names check (char_length(coalesce(names,'')) <= 2000) not valid;
  end if;
end $$;

-- 4) statistics columns
alter table public.stat_edits drop constraint if exists stat_edits_per_check;
alter table public.stat_edits add constraint stat_edits_per_check check (per in ('day','week','month'));
alter table public.stat_edits drop constraint if exists stat_edits_col_check;
alter table public.stat_edits add constraint stat_edits_col_check check (col in ('r','w','s','a','b'));

-- 2) who someone says he is, until an admin gives the role
alter table public.staff add column if not exists want text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ruqya_staff_want') then
    alter table public.staff add constraint ruqya_staff_want check (want is null or want in ('agent','specialist'));
  end if;
end $$;

create or replace function public.ruqya_sees_all() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.ruqya_is_admin() or exists (select 1 from public.staff where id = auth.uid() and role = 'agent'), false)
$$;
-- the calendar columns of the signed-in specialist (matched by name, as the app does)
create or replace function public.ruqya_my_readers() returns setof uuid
language sql stable security definer set search_path = public as $$
  select r.id from public.readers r join public.staff s
    on s.id = auth.uid() and s.role = 'specialist' and lower(btrim(r.name)) = lower(btrim(s.name))
$$;
revoke all on function public.ruqya_sees_all() from public;
revoke all on function public.ruqya_my_readers() from public;
grant execute on function public.ruqya_sees_all(), public.ruqya_my_readers() to authenticated;

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
  if new.name is not null and (tg_op = 'INSERT' or new.name is distinct from old.name)
     and exists (select 1 from public.staff s where s.id <> new.id and lower(btrim(s.name)) = lower(btrim(new.name))
                 and not (coalesce(new.role, new.want, '') = 'specialist' and coalesce(s.role, '') = 'specialist')) then
    raise exception 'Bu ad artiq var' using errcode = '23505';
  end if;
  if tg_op = 'INSERT' then
    if not adm then new.role := null; end if;                     -- a role is given only by an admin
  else
    if new.role is distinct from old.role then
      if not adm then
        raise exception 'Rolu admin deyisir' using errcode = '42501';
      elsif old.id = auth.uid() and old.role = 'admin' then
        new.role := old.role;                                       -- an admin cannot drop his own admin role
      end if;
    end if;
    if not adm and old.role = 'specialist' and new.name is distinct from old.name then
      raise exception 'Mutexessisin adini admin deyisir' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.ruqya_staff_guard() from public;

update public.staff set role = 'agent' where role is null and id <> 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid;

-- 1) sessions: everything for agents and admins, own column only for a specialist, nothing for a person without a role
drop policy if exists "staff appts" on public.appts;
drop policy if exists ruqya_appts_read on public.appts;
drop policy if exists ruqya_appts_write on public.appts;
create policy ruqya_appts_read on public.appts for select to authenticated
  using ((select public.ruqya_sees_all()) or reader_id in (select public.ruqya_my_readers()));
create policy ruqya_appts_write on public.appts for all to authenticated
  using ((select public.ruqya_sees_all()) or reader_id in (select public.ruqya_my_readers()))
  with check ((select public.ruqya_sees_all()) or reader_id in (select public.ruqya_my_readers()));

-- Kassa and statistics corrections: agents and admins only
drop policy if exists "expenses all" on public.expenses;
drop policy if exists ruqya_expenses_staff on public.expenses;
create policy ruqya_expenses_staff on public.expenses for all to authenticated
  using ((select public.ruqya_sees_all())) with check ((select public.ruqya_sees_all()));
drop policy if exists "product sales all" on public.product_sales;
drop policy if exists ruqya_products_staff on public.product_sales;
create policy ruqya_products_staff on public.product_sales for all to authenticated
  using ((select public.ruqya_sees_all())) with check ((select public.ruqya_sees_all()));
drop policy if exists "read stat edits" on public.stat_edits;
create policy "read stat edits" on public.stat_edits for select to authenticated using ((select public.ruqya_sees_all()));

-- the change journal keeps old values of sessions; it stays admin-only (unchanged)

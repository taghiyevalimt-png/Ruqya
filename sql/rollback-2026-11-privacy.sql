-- Undo of 2026-11-privacy.sql: everyone signed in sees all sessions and Kassa again; roles as before.
-- The new columns (product names, want) and the corrections columns stay; they do no harm.
drop policy if exists ruqya_appts_read on public.appts;
drop policy if exists ruqya_appts_write on public.appts;
drop policy if exists "staff appts" on public.appts;
create policy "staff appts" on public.appts for all to authenticated using (true) with check (true);
drop policy if exists ruqya_expenses_staff on public.expenses;
drop policy if exists "expenses all" on public.expenses;
create policy "expenses all" on public.expenses for all to authenticated using (true) with check (true);
drop policy if exists ruqya_products_staff on public.product_sales;
drop policy if exists "product sales all" on public.product_sales;
create policy "product sales all" on public.product_sales for all to authenticated using (true) with check (true);
drop policy if exists "read stat edits" on public.stat_edits;
create policy "read stat edits" on public.stat_edits for select to authenticated using (true);
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

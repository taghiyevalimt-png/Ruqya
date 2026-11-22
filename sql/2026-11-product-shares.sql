-- Mərkəz (owner 22.11): a percent of a product's price for the person who sells it (specialist or sales agent).
-- «Ruqyalı sirkə, Loğman 50%» → when Loğman sells it for 20 ₼, his statistics show 10 ₼ that stays with him.
-- Everybody except admins sees only his own percents. Safe to run again. Undo: rollback-2026-11-product-shares.sql
create table if not exists public.product_shares(
  product_id uuid not null references public.products(id) on delete cascade,
  staff_id uuid not null,
  pct numeric not null check (pct > 0 and pct <= 100),
  updated_at timestamptz not null default now(),
  primary key (product_id, staff_id)
);
alter table public.product_shares enable row level security;
drop trigger if exists ruqya_audit on public.product_shares;
drop trigger if exists ruqya_zthrottle on public.product_shares;
create trigger ruqya_zthrottle after insert or update or delete on public.product_shares for each row execute function public.ruqya_throttle();
drop policy if exists ruqya_pshares_read on public.product_shares;
drop policy if exists ruqya_pshares_admin on public.product_shares;
drop policy if exists ruqya_no_anonymous on public.product_shares;
create policy ruqya_pshares_read on public.product_shares for select to authenticated
  using ((select public.ruqya_is_admin()) or ((select public.ruqya_has_role()) and staff_id = (select auth.uid())));
create policy ruqya_pshares_admin on public.product_shares for all to authenticated
  using ((select public.ruqya_is_admin())) with check ((select public.ruqya_is_admin()));
create policy ruqya_no_anonymous on public.product_shares as restrictive for all to authenticated
  using (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false)
  with check (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);
revoke all on public.product_shares from anon;
revoke truncate, trigger, references on public.product_shares from authenticated;
grant select, insert, update, delete on public.product_shares to authenticated;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'product_shares') then
    alter publication supabase_realtime add table public.product_shares;
  end if;
end $$;
select 'OK' as result;

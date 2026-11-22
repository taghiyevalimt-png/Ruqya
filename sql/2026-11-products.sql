-- Mərkəz (owner 22.11): product sales with buttons. The admin keeps a list of products (name, price); a sale is
-- tapped together from those buttons (one tap = one piece). Specialists sell too and see only their own sales;
-- sales agents and admins see all of them. Safe to run again. Undo: rollback-2026-11-products.sql
create table if not exists public.products(
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  price numeric not null check (price >= 0 and price <= 1000000),
  archived boolean not null default false,
  sort integer not null default 0 check (sort between -100000 and 100000),
  created_at timestamptz not null default now()
);
alter table public.products enable row level security;
drop trigger if exists ruqya_audit on public.products;
create trigger ruqya_audit after insert or update or delete on public.products for each row execute function public.ruqya_audit();
drop trigger if exists ruqya_zthrottle on public.products;
create trigger ruqya_zthrottle after insert or update or delete on public.products for each row execute function public.ruqya_throttle();
drop policy if exists ruqya_products_list_read on public.products;
drop policy if exists ruqya_products_list_admin on public.products;
drop policy if exists ruqya_no_anonymous on public.products;
create policy ruqya_products_list_read on public.products for select to authenticated using ((select public.ruqya_has_role()));
create policy ruqya_products_list_admin on public.products for all to authenticated
  using ((select public.ruqya_is_admin())) with check ((select public.ruqya_is_admin()));
create policy ruqya_no_anonymous on public.products as restrictive for all to authenticated
  using (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false)
  with check (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);
revoke all on public.products from anon;
revoke truncate, trigger, references on public.products from authenticated;
grant select, insert, update, delete on public.products to authenticated;

-- a sale line: which product, how many, the price of one piece at the time of the sale (amount = qty × price;
-- names keeps the product's name, so older screens and the Excel file still read it)
alter table public.product_sales add column if not exists product_id uuid references public.products(id) on delete set null;
alter table public.product_sales add column if not exists qty integer;
alter table public.product_sales add column if not exists price numeric;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ruqya_psales_qty') then
    alter table public.product_sales add constraint ruqya_psales_qty check (qty is null or qty between 1 and 1000); end if;
  if not exists (select 1 from pg_constraint where conname = 'ruqya_psales_price') then
    alter table public.product_sales add constraint ruqya_psales_price check (price is null or (price >= 0 and price <= 1000000)); end if;
end $$;
create index if not exists product_sales_product on public.product_sales (product_id);

-- who sees which sales: admins and sales agents all; anybody else with a role (specialists) only their own.
-- Changing or deleting: admins any sale, everybody else only their own.
drop policy if exists ruqya_products_staff on public.product_sales;
drop policy if exists ruqya_psales_read on public.product_sales;
drop policy if exists ruqya_psales_own on public.product_sales;
create policy ruqya_psales_read on public.product_sales for select to authenticated
  using ((select public.ruqya_sees_all()) or ((select public.ruqya_has_role()) and created_by = (select auth.uid())));
create policy ruqya_psales_own on public.product_sales for all to authenticated
  using ((select public.ruqya_is_admin()) or ((select public.ruqya_has_role()) and created_by = (select auth.uid())))
  with check ((select public.ruqya_is_admin()) or ((select public.ruqya_has_role()) and created_by = (select auth.uid())));

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'products') then
    alter publication supabase_realtime add table public.products;
  end if;
end $$;
select 'OK' as result;

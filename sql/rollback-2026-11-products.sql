-- Undo 2026-11-products.sql: the product list goes away; sales stay (with their amount and product name),
-- and the old rule comes back (admins see all sales, sales agents only their own, specialists none).
drop policy if exists ruqya_psales_read on public.product_sales;
drop policy if exists ruqya_psales_own on public.product_sales;
drop policy if exists ruqya_products_staff on public.product_sales;
create policy ruqya_products_staff on public.product_sales for all to authenticated
  using ((select public.ruqya_is_admin()) or ((select public.ruqya_sees_all()) and created_by = (select auth.uid())))
  with check ((select public.ruqya_is_admin()) or ((select public.ruqya_sees_all()) and created_by = (select auth.uid())));
alter table public.product_sales drop constraint if exists ruqya_psales_qty;
alter table public.product_sales drop constraint if exists ruqya_psales_price;
drop index if exists public.product_sales_product;
alter table public.product_sales drop column if exists product_id;
alter table public.product_sales drop column if exists qty;
alter table public.product_sales drop column if exists price;
do $$ begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'products') then
    alter publication supabase_realtime drop table public.products;
  end if;
end $$;
drop table if exists public.products;
select 'OK' as result;

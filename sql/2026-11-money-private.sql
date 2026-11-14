-- 2026-11-money-private.sql — money stays with admins, also through the database API (run once; safe to run again)
-- Needs the app version from 2026-11-14 or newer (it reads specialists without price/share).
-- 1) specialists' default price and share: nobody reads them through the API (the app does not use them;
--    admins still write them; restore and colour change run as the database owner)
revoke select on public.readers from authenticated, anon;
grant select (id, name, archived, created_at, color) on public.readers to authenticated;
-- 2) Kassa (expenses, product sales): admins see and change everything; an agent only the entries he wrote
drop policy if exists ruqya_expenses_staff on public.expenses;
create policy ruqya_expenses_staff on public.expenses for all to authenticated
  using ((select public.ruqya_is_admin()) or ((select public.ruqya_sees_all()) and created_by = (select auth.uid())))
  with check ((select public.ruqya_is_admin()) or ((select public.ruqya_sees_all()) and created_by = (select auth.uid())));
drop policy if exists ruqya_products_staff on public.product_sales;
create policy ruqya_products_staff on public.product_sales for all to authenticated
  using ((select public.ruqya_is_admin()) or ((select public.ruqya_sees_all()) and created_by = (select auth.uid())))
  with check ((select public.ruqya_is_admin()) or ((select public.ruqya_sees_all()) and created_by = (select auth.uid())));
select 'OK' as result;

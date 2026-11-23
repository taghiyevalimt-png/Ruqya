-- Mərkəz (owner 23.11): «if sales agents sell products from which a specialist gets something, the specialist must see
-- that sale in full in Kassa, and in his statistics what concerns his product and which agent sold it».
-- A specialist with a share in a product (product_shares: staff_id = the specialist, pct or amt set) now also reads every
-- sale of that product, whoever sold it. Changing and deleting a sale stay as they were (the seller and admins).
-- Safe to run again. Undo: rollback-2026-11-product-owner.sql
drop policy if exists ruqya_product_sales_select on public.product_sales;
create policy ruqya_product_sales_select on public.product_sales for select to authenticated using (
  (select private.ruqya_is_admin())
  or (select private.ruqya_sees_all())
  or ((select private.ruqya_has_role()) and (
        created_by = (select auth.uid())
        or exists (select 1 from public.product_shares s
                   where s.product_id = product_sales.product_id and s.staff_id = (select auth.uid())
                     and (coalesce(s.pct, 0) > 0 or coalesce(s.amt, 0) > 0)))));
select 'OK' as result;

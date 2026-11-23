-- Undo 2026-11-product-owner.sql: specialists read only their own sales again (the policy of audit 6).
drop policy if exists ruqya_product_sales_select on public.product_sales;
create policy ruqya_product_sales_select on public.product_sales for select to authenticated using (((( SELECT private.ruqya_is_admin() AS ruqya_is_admin) OR (( SELECT private.ruqya_has_role() AS ruqya_has_role) AND (created_by = ( SELECT auth.uid() AS uid))))) or ((( SELECT private.ruqya_sees_all() AS ruqya_sees_all) OR (( SELECT private.ruqya_has_role() AS ruqya_has_role) AND (created_by = ( SELECT auth.uid() AS uid))))));
select 'OK' as result;

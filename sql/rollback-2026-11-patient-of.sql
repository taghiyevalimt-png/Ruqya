-- Undo 2026-11-patient-of.sql: back to the rule of 2026-11-product-owner.sql (a specialist reads every sale of a product
-- he has a share in). The column patient_of is dropped with what was chosen in it.
drop policy if exists ruqya_product_sales_select on public.product_sales;
create policy ruqya_product_sales_select on public.product_sales for select to authenticated using (
  (select private.ruqya_is_admin())
  or (select private.ruqya_sees_all())
  or ((select private.ruqya_has_role()) and (
        created_by = (select auth.uid())
        or exists (select 1 from public.product_shares s
                   where s.product_id = product_sales.product_id and s.staff_id = (select auth.uid())
                     and (coalesce(s.pct, 0) > 0 or coalesce(s.amt, 0) > 0)))));
drop trigger if exists ruqya_zpatient on public.product_sales;
drop function if exists public.ruqya_psale_patient();
drop index if exists public.product_sales_patient_of;
alter table public.product_sales drop column if exists patient_of;
select 'OK' as result;

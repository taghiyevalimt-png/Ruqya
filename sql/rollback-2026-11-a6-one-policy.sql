-- Undo of 2026-11-a6-one-policy.sql: the previous policies, as they were, back on the 9 tables.
begin;
-- appts
drop policy if exists ruqya_appts_select on public.appts;
drop policy if exists ruqya_appts_insert on public.appts;
drop policy if exists ruqya_appts_update on public.appts;
drop policy if exists ruqya_appts_delete on public.appts;
drop policy if exists "ruqya_appts_read" on public.appts;
create policy "ruqya_appts_read" on public.appts for select to authenticated using ((( SELECT private.ruqya_sees_all() AS ruqya_sees_all) OR (reader_id IN ( SELECT private.ruqya_my_readers() AS ruqya_my_readers))));
drop policy if exists "ruqya_appts_write" on public.appts;
create policy "ruqya_appts_write" on public.appts for all to authenticated using ((( SELECT private.ruqya_sees_all() AS ruqya_sees_all) OR (reader_id IN ( SELECT private.ruqya_my_readers() AS ruqya_my_readers)))) with check ((( SELECT private.ruqya_sees_all() AS ruqya_sees_all) OR (reader_id IN ( SELECT private.ruqya_my_readers() AS ruqya_my_readers))));
-- breaks
drop policy if exists ruqya_breaks_select on public.breaks;
drop policy if exists ruqya_breaks_insert on public.breaks;
drop policy if exists ruqya_breaks_update on public.breaks;
drop policy if exists ruqya_breaks_delete on public.breaks;
drop policy if exists "read breaks" on public.breaks;
create policy "read breaks" on public.breaks for select to authenticated using (( SELECT private.ruqya_has_role() AS ruqya_has_role));
drop policy if exists "ruqya_breaks_specialist" on public.breaks;
create policy "ruqya_breaks_specialist" on public.breaks for all to authenticated using (((reader_id IS NOT NULL) AND (reader_id IN ( SELECT private.ruqya_my_readers() AS ruqya_my_readers)))) with check (((reader_id IS NOT NULL) AND (reader_id IN ( SELECT private.ruqya_my_readers() AS ruqya_my_readers))));
drop policy if exists "ruqya_breaks_staff" on public.breaks;
create policy "ruqya_breaks_staff" on public.breaks for all to authenticated using (( SELECT private.ruqya_can_breaks() AS ruqya_can_breaks)) with check (( SELECT private.ruqya_can_breaks() AS ruqya_can_breaks));
-- product_sales
drop policy if exists ruqya_product_sales_select on public.product_sales;
drop policy if exists ruqya_product_sales_insert on public.product_sales;
drop policy if exists ruqya_product_sales_update on public.product_sales;
drop policy if exists ruqya_product_sales_delete on public.product_sales;
drop policy if exists "ruqya_psales_own" on public.product_sales;
create policy "ruqya_psales_own" on public.product_sales for all to authenticated using ((( SELECT private.ruqya_is_admin() AS ruqya_is_admin) OR (( SELECT private.ruqya_has_role() AS ruqya_has_role) AND (created_by = ( SELECT auth.uid() AS uid))))) with check ((( SELECT private.ruqya_is_admin() AS ruqya_is_admin) OR (( SELECT private.ruqya_has_role() AS ruqya_has_role) AND (created_by = ( SELECT auth.uid() AS uid)))));
drop policy if exists "ruqya_psales_read" on public.product_sales;
create policy "ruqya_psales_read" on public.product_sales for select to authenticated using ((( SELECT private.ruqya_sees_all() AS ruqya_sees_all) OR (( SELECT private.ruqya_has_role() AS ruqya_has_role) AND (created_by = ( SELECT auth.uid() AS uid)))));
-- product_shares
drop policy if exists ruqya_product_shares_select on public.product_shares;
drop policy if exists ruqya_product_shares_insert on public.product_shares;
drop policy if exists ruqya_product_shares_update on public.product_shares;
drop policy if exists ruqya_product_shares_delete on public.product_shares;
drop policy if exists "ruqya_pshares_admin" on public.product_shares;
create policy "ruqya_pshares_admin" on public.product_shares for all to authenticated using (( SELECT private.ruqya_is_admin() AS ruqya_is_admin)) with check (( SELECT private.ruqya_is_admin() AS ruqya_is_admin));
drop policy if exists "ruqya_pshares_read" on public.product_shares;
create policy "ruqya_pshares_read" on public.product_shares for select to authenticated using ((( SELECT private.ruqya_is_admin() AS ruqya_is_admin) OR (( SELECT private.ruqya_has_role() AS ruqya_has_role) AND (staff_id = ( SELECT auth.uid() AS uid)))));
-- products
drop policy if exists ruqya_products_select on public.products;
drop policy if exists ruqya_products_insert on public.products;
drop policy if exists ruqya_products_update on public.products;
drop policy if exists ruqya_products_delete on public.products;
drop policy if exists "ruqya_products_list_admin" on public.products;
create policy "ruqya_products_list_admin" on public.products for all to authenticated using (( SELECT private.ruqya_is_admin() AS ruqya_is_admin)) with check (( SELECT private.ruqya_is_admin() AS ruqya_is_admin));
drop policy if exists "ruqya_products_list_read" on public.products;
create policy "ruqya_products_list_read" on public.products for select to authenticated using (( SELECT private.ruqya_has_role() AS ruqya_has_role));
-- readers
drop policy if exists ruqya_readers_select on public.readers;
drop policy if exists ruqya_readers_insert on public.readers;
drop policy if exists ruqya_readers_update on public.readers;
drop policy if exists ruqya_readers_delete on public.readers;
drop policy if exists "read readers" on public.readers;
create policy "read readers" on public.readers for select to authenticated using (true);
drop policy if exists "ruqya_readers_admin" on public.readers;
create policy "ruqya_readers_admin" on public.readers for all to authenticated using (( SELECT private.ruqya_is_admin() AS ruqya_is_admin)) with check (( SELECT private.ruqya_is_admin() AS ruqya_is_admin));
-- services
drop policy if exists ruqya_services_select on public.services;
drop policy if exists ruqya_services_insert on public.services;
drop policy if exists ruqya_services_update on public.services;
drop policy if exists ruqya_services_delete on public.services;
drop policy if exists "owner services" on public.services;
create policy "owner services" on public.services for all to authenticated using ((( SELECT auth.uid() AS uid) = 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid)) with check ((( SELECT auth.uid() AS uid) = 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid));
drop policy if exists "read services" on public.services;
create policy "read services" on public.services for select to authenticated using (true);
-- staff
drop policy if exists ruqya_staff_select on public.staff;
drop policy if exists ruqya_staff_insert on public.staff;
drop policy if exists ruqya_staff_update on public.staff;
drop policy if exists ruqya_staff_delete on public.staff;
drop policy if exists "own staff insert" on public.staff;
create policy "own staff insert" on public.staff for insert to authenticated with check ((id = ( SELECT auth.uid() AS uid)));
drop policy if exists "own staff update" on public.staff;
create policy "own staff update" on public.staff for update to authenticated using ((id = ( SELECT auth.uid() AS uid))) with check ((id = ( SELECT auth.uid() AS uid)));
drop policy if exists "read staff" on public.staff;
create policy "read staff" on public.staff for select to authenticated using (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.ruqya_has_role() AS ruqya_has_role)));
drop policy if exists "ruqya_staff_admin" on public.staff;
create policy "ruqya_staff_admin" on public.staff for update to authenticated using (( SELECT private.ruqya_is_admin() AS ruqya_is_admin)) with check (( SELECT private.ruqya_is_admin() AS ruqya_is_admin));
-- stat_edits
drop policy if exists ruqya_stat_edits_select on public.stat_edits;
drop policy if exists ruqya_stat_edits_insert on public.stat_edits;
drop policy if exists ruqya_stat_edits_update on public.stat_edits;
drop policy if exists ruqya_stat_edits_delete on public.stat_edits;
drop policy if exists "read stat edits" on public.stat_edits;
create policy "read stat edits" on public.stat_edits for select to authenticated using ((( SELECT private.ruqya_is_admin() AS ruqya_is_admin) OR (( SELECT private.ruqya_can_stats() AS ruqya_can_stats) AND (agent_id = (( SELECT auth.uid() AS uid))::text))));
drop policy if exists "ruqya_stat_edits_write" on public.stat_edits;
create policy "ruqya_stat_edits_write" on public.stat_edits for all to authenticated using ((( SELECT private.ruqya_is_admin() AS ruqya_is_admin) OR (( SELECT private.ruqya_can_stats() AS ruqya_can_stats) AND (agent_id = (( SELECT auth.uid() AS uid))::text)))) with check ((( SELECT private.ruqya_is_admin() AS ruqya_is_admin) OR (( SELECT private.ruqya_can_stats() AS ruqya_can_stats) AND (agent_id = (( SELECT auth.uid() AS uid))::text)))
);
commit;
select 'OK' as result;

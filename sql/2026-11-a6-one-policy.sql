-- Audit 6 (Supabase Advisors «multiple permissive policies», 12 warnings): on 9 tables several permissive policies
-- applied to the same role and action, so each was evaluated on every row. PostgreSQL joins permissive policies with OR;
-- here they are joined into one policy per table and action with exactly that OR (generated from the database's own
-- policy text), so the rights do not change — checked cell by cell with the access matrix (tests/access-matrix.js,
-- 288 cells, before = after). The restrictive «ruqya_no_anonymous» policies stay as they are.
-- Requires 2026-11-a6-private-helpers.sql first. Safe to run again. Undo: rollback-2026-11-a6-one-policy.sql
begin;
-- appts
drop policy if exists "ruqya_appts_read" on public.appts;
drop policy if exists "ruqya_appts_write" on public.appts;
drop policy if exists ruqya_appts_select on public.appts;
create policy ruqya_appts_select on public.appts for select to authenticated using ((( SELECT private.ruqya_sees_all() AS ruqya_sees_all) OR (reader_id IN ( SELECT private.ruqya_my_readers() AS ruqya_my_readers))));
drop policy if exists ruqya_appts_insert on public.appts;
create policy ruqya_appts_insert on public.appts for insert to authenticated with check ((( SELECT private.ruqya_sees_all() AS ruqya_sees_all) OR (reader_id IN ( SELECT private.ruqya_my_readers() AS ruqya_my_readers))));
drop policy if exists ruqya_appts_update on public.appts;
create policy ruqya_appts_update on public.appts for update to authenticated using ((( SELECT private.ruqya_sees_all() AS ruqya_sees_all) OR (reader_id IN ( SELECT private.ruqya_my_readers() AS ruqya_my_readers)))) with check ((( SELECT private.ruqya_sees_all() AS ruqya_sees_all) OR (reader_id IN ( SELECT private.ruqya_my_readers() AS ruqya_my_readers))));
drop policy if exists ruqya_appts_delete on public.appts;
create policy ruqya_appts_delete on public.appts for delete to authenticated using ((( SELECT private.ruqya_sees_all() AS ruqya_sees_all) OR (reader_id IN ( SELECT private.ruqya_my_readers() AS ruqya_my_readers))));
-- breaks
drop policy if exists "read breaks" on public.breaks;
drop policy if exists "ruqya_breaks_specialist" on public.breaks;
drop policy if exists "ruqya_breaks_staff" on public.breaks;
drop policy if exists ruqya_breaks_select on public.breaks;
create policy ruqya_breaks_select on public.breaks for select to authenticated using ((( SELECT private.ruqya_has_role() AS ruqya_has_role)) or (((reader_id IS NOT NULL) AND (reader_id IN ( SELECT private.ruqya_my_readers() AS ruqya_my_readers)))) or (( SELECT private.ruqya_can_breaks() AS ruqya_can_breaks)));
drop policy if exists ruqya_breaks_insert on public.breaks;
create policy ruqya_breaks_insert on public.breaks for insert to authenticated with check ((((reader_id IS NOT NULL) AND (reader_id IN ( SELECT private.ruqya_my_readers() AS ruqya_my_readers)))) or (( SELECT private.ruqya_can_breaks() AS ruqya_can_breaks)));
drop policy if exists ruqya_breaks_update on public.breaks;
create policy ruqya_breaks_update on public.breaks for update to authenticated using ((((reader_id IS NOT NULL) AND (reader_id IN ( SELECT private.ruqya_my_readers() AS ruqya_my_readers)))) or (( SELECT private.ruqya_can_breaks() AS ruqya_can_breaks))) with check ((((reader_id IS NOT NULL) AND (reader_id IN ( SELECT private.ruqya_my_readers() AS ruqya_my_readers)))) or (( SELECT private.ruqya_can_breaks() AS ruqya_can_breaks)));
drop policy if exists ruqya_breaks_delete on public.breaks;
create policy ruqya_breaks_delete on public.breaks for delete to authenticated using ((((reader_id IS NOT NULL) AND (reader_id IN ( SELECT private.ruqya_my_readers() AS ruqya_my_readers)))) or (( SELECT private.ruqya_can_breaks() AS ruqya_can_breaks)));
-- product_sales
drop policy if exists "ruqya_psales_own" on public.product_sales;
drop policy if exists "ruqya_psales_read" on public.product_sales;
drop policy if exists ruqya_product_sales_select on public.product_sales;
create policy ruqya_product_sales_select on public.product_sales for select to authenticated using (((( SELECT private.ruqya_is_admin() AS ruqya_is_admin) OR (( SELECT private.ruqya_has_role() AS ruqya_has_role) AND (created_by = ( SELECT auth.uid() AS uid))))) or ((( SELECT private.ruqya_sees_all() AS ruqya_sees_all) OR (( SELECT private.ruqya_has_role() AS ruqya_has_role) AND (created_by = ( SELECT auth.uid() AS uid))))));
drop policy if exists ruqya_product_sales_insert on public.product_sales;
create policy ruqya_product_sales_insert on public.product_sales for insert to authenticated with check ((( SELECT private.ruqya_is_admin() AS ruqya_is_admin) OR (( SELECT private.ruqya_has_role() AS ruqya_has_role) AND (created_by = ( SELECT auth.uid() AS uid)))));
drop policy if exists ruqya_product_sales_update on public.product_sales;
create policy ruqya_product_sales_update on public.product_sales for update to authenticated using ((( SELECT private.ruqya_is_admin() AS ruqya_is_admin) OR (( SELECT private.ruqya_has_role() AS ruqya_has_role) AND (created_by = ( SELECT auth.uid() AS uid))))) with check ((( SELECT private.ruqya_is_admin() AS ruqya_is_admin) OR (( SELECT private.ruqya_has_role() AS ruqya_has_role) AND (created_by = ( SELECT auth.uid() AS uid)))));
drop policy if exists ruqya_product_sales_delete on public.product_sales;
create policy ruqya_product_sales_delete on public.product_sales for delete to authenticated using ((( SELECT private.ruqya_is_admin() AS ruqya_is_admin) OR (( SELECT private.ruqya_has_role() AS ruqya_has_role) AND (created_by = ( SELECT auth.uid() AS uid)))));
-- product_shares
drop policy if exists "ruqya_pshares_admin" on public.product_shares;
drop policy if exists "ruqya_pshares_read" on public.product_shares;
drop policy if exists ruqya_product_shares_select on public.product_shares;
create policy ruqya_product_shares_select on public.product_shares for select to authenticated using ((( SELECT private.ruqya_is_admin() AS ruqya_is_admin)) or ((( SELECT private.ruqya_is_admin() AS ruqya_is_admin) OR (( SELECT private.ruqya_has_role() AS ruqya_has_role) AND (staff_id = ( SELECT auth.uid() AS uid))))));
drop policy if exists ruqya_product_shares_insert on public.product_shares;
create policy ruqya_product_shares_insert on public.product_shares for insert to authenticated with check (( SELECT private.ruqya_is_admin() AS ruqya_is_admin));
drop policy if exists ruqya_product_shares_update on public.product_shares;
create policy ruqya_product_shares_update on public.product_shares for update to authenticated using (( SELECT private.ruqya_is_admin() AS ruqya_is_admin)) with check (( SELECT private.ruqya_is_admin() AS ruqya_is_admin));
drop policy if exists ruqya_product_shares_delete on public.product_shares;
create policy ruqya_product_shares_delete on public.product_shares for delete to authenticated using (( SELECT private.ruqya_is_admin() AS ruqya_is_admin));
-- products
drop policy if exists "ruqya_products_list_admin" on public.products;
drop policy if exists "ruqya_products_list_read" on public.products;
drop policy if exists ruqya_products_select on public.products;
create policy ruqya_products_select on public.products for select to authenticated using ((( SELECT private.ruqya_is_admin() AS ruqya_is_admin)) or (( SELECT private.ruqya_has_role() AS ruqya_has_role)));
drop policy if exists ruqya_products_insert on public.products;
create policy ruqya_products_insert on public.products for insert to authenticated with check (( SELECT private.ruqya_is_admin() AS ruqya_is_admin));
drop policy if exists ruqya_products_update on public.products;
create policy ruqya_products_update on public.products for update to authenticated using (( SELECT private.ruqya_is_admin() AS ruqya_is_admin)) with check (( SELECT private.ruqya_is_admin() AS ruqya_is_admin));
drop policy if exists ruqya_products_delete on public.products;
create policy ruqya_products_delete on public.products for delete to authenticated using (( SELECT private.ruqya_is_admin() AS ruqya_is_admin));
-- readers
drop policy if exists "read readers" on public.readers;
drop policy if exists "ruqya_readers_admin" on public.readers;
drop policy if exists ruqya_readers_select on public.readers;
create policy ruqya_readers_select on public.readers for select to authenticated using (true);
drop policy if exists ruqya_readers_insert on public.readers;
create policy ruqya_readers_insert on public.readers for insert to authenticated with check (( SELECT private.ruqya_is_admin() AS ruqya_is_admin));
drop policy if exists ruqya_readers_update on public.readers;
create policy ruqya_readers_update on public.readers for update to authenticated using (( SELECT private.ruqya_is_admin() AS ruqya_is_admin)) with check (( SELECT private.ruqya_is_admin() AS ruqya_is_admin));
drop policy if exists ruqya_readers_delete on public.readers;
create policy ruqya_readers_delete on public.readers for delete to authenticated using (( SELECT private.ruqya_is_admin() AS ruqya_is_admin));
-- services
drop policy if exists "owner services" on public.services;
drop policy if exists "read services" on public.services;
drop policy if exists ruqya_services_select on public.services;
create policy ruqya_services_select on public.services for select to authenticated using (true);
drop policy if exists ruqya_services_insert on public.services;
create policy ruqya_services_insert on public.services for insert to authenticated with check ((( SELECT auth.uid() AS uid) = 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid));
drop policy if exists ruqya_services_update on public.services;
create policy ruqya_services_update on public.services for update to authenticated using ((( SELECT auth.uid() AS uid) = 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid)) with check ((( SELECT auth.uid() AS uid) = 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid));
drop policy if exists ruqya_services_delete on public.services;
create policy ruqya_services_delete on public.services for delete to authenticated using ((( SELECT auth.uid() AS uid) = 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid));
-- staff
drop policy if exists "own staff insert" on public.staff;
drop policy if exists "own staff update" on public.staff;
drop policy if exists "read staff" on public.staff;
drop policy if exists "ruqya_staff_admin" on public.staff;
drop policy if exists ruqya_staff_select on public.staff;
create policy ruqya_staff_select on public.staff for select to authenticated using (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.ruqya_has_role() AS ruqya_has_role)));
drop policy if exists ruqya_staff_insert on public.staff;
create policy ruqya_staff_insert on public.staff for insert to authenticated with check ((id = ( SELECT auth.uid() AS uid)));
drop policy if exists ruqya_staff_update on public.staff;
create policy ruqya_staff_update on public.staff for update to authenticated using (((id = ( SELECT auth.uid() AS uid))) or (( SELECT private.ruqya_is_admin() AS ruqya_is_admin))) with check (((id = ( SELECT auth.uid() AS uid))) or (( SELECT private.ruqya_is_admin() AS ruqya_is_admin)));
-- stat_edits
drop policy if exists "read stat edits" on public.stat_edits;
drop policy if exists "ruqya_stat_edits_write" on public.stat_edits;
drop policy if exists ruqya_stat_edits_select on public.stat_edits;
create policy ruqya_stat_edits_select on public.stat_edits for select to authenticated using ((( SELECT private.ruqya_is_admin() AS ruqya_is_admin) OR (( SELECT private.ruqya_can_stats() AS ruqya_can_stats) AND (agent_id = (( SELECT auth.uid() AS uid))::text))));
drop policy if exists ruqya_stat_edits_insert on public.stat_edits;
create policy ruqya_stat_edits_insert on public.stat_edits for insert to authenticated with check ((( SELECT private.ruqya_is_admin() AS ruqya_is_admin) OR (( SELECT private.ruqya_can_stats() AS ruqya_can_stats) AND (agent_id = (( SELECT auth.uid() AS uid))::text)))
);
drop policy if exists ruqya_stat_edits_update on public.stat_edits;
create policy ruqya_stat_edits_update on public.stat_edits for update to authenticated using ((( SELECT private.ruqya_is_admin() AS ruqya_is_admin) OR (( SELECT private.ruqya_can_stats() AS ruqya_can_stats) AND (agent_id = (( SELECT auth.uid() AS uid))::text)))) with check ((( SELECT private.ruqya_is_admin() AS ruqya_is_admin) OR (( SELECT private.ruqya_can_stats() AS ruqya_can_stats) AND (agent_id = (( SELECT auth.uid() AS uid))::text)))
);
drop policy if exists ruqya_stat_edits_delete on public.stat_edits;
create policy ruqya_stat_edits_delete on public.stat_edits for delete to authenticated using ((( SELECT private.ruqya_is_admin() AS ruqya_is_admin) OR (( SELECT private.ruqya_can_stats() AS ruqya_can_stats) AND (agent_id = (( SELECT auth.uid() AS uid))::text))));
commit;
select 'OK' as result;

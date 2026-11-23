-- Mərkəz (owner 23.11): a product's money goes to the specialist whose PATIENT bought it. Every sale says whose patient:
--   a specialist selling → himself (set here by the database, whatever the phone sends);
--   a sales agent selling → the specialist chosen in the sale window, or NULL = «Keçici» (nobody's patient).
-- A specialist reads his own sales and the sales to his patients (with the agent who sold); neutral sales only the seller
-- (agents and admins read all, as before). Earlier agents' sales stay neutral; earlier specialists' sales become theirs.
-- Replaces the rule of 2026-11-product-owner.sql (a specialist saw every sale of «his» products).
-- Safe to run again. Undo: rollback-2026-11-patient-of.sql
alter table public.product_sales add column if not exists patient_of uuid;

create or replace function public.ruqya_psale_patient() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  select s.role into r from public.staff s where s.id = new.created_by;
  if r = 'specialist' then
    new.patient_of := new.created_by;          -- a specialist's own sale is always his patient's
  elsif new.patient_of is not null and not exists (select 1 from public.staff s where s.id = new.patient_of and s.role = 'specialist') then
    raise exception 'Pasiyentin mutexessisi duzgun deyil' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.ruqya_psale_patient() from public, anon, authenticated;

drop trigger if exists ruqya_zpatient on public.product_sales;
-- named after ruqya_stamp: BEFORE triggers run in name order, and ruqya_stamp sets created_by = the signed-in user
create trigger ruqya_zpatient before insert or update of patient_of, created_by on public.product_sales
  for each row execute function public.ruqya_psale_patient();

-- earlier sales: a specialist's own sale is his patient's; agents' sales stay neutral (NULL)
update public.product_sales p set patient_of = p.created_by
  where p.patient_of is null and exists (select 1 from public.staff s where s.id = p.created_by and s.role = 'specialist');

create index if not exists product_sales_patient_of on public.product_sales (patient_of) where patient_of is not null;

drop policy if exists ruqya_product_sales_select on public.product_sales;
create policy ruqya_product_sales_select on public.product_sales for select to authenticated using (
  (select private.ruqya_is_admin())
  or (select private.ruqya_sees_all())
  or ((select private.ruqya_has_role()) and (created_by = (select auth.uid()) or patient_of = (select auth.uid()))));
select 'OK' as result;

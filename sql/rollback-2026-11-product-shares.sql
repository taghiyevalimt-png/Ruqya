-- Undo 2026-11-product-shares.sql: the sellers' percents are forgotten (statistics stop showing «Payı»).
do $$ begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'product_shares') then
    alter publication supabase_realtime drop table public.product_shares;
  end if;
end $$;
drop table if exists public.product_shares;
select 'OK' as result;

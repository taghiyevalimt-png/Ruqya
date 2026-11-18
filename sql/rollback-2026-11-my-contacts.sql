-- Rollback of sql/2026-11-my-contacts.sql (the app then adds only the agent's patients of the loaded weeks).
drop function if exists public.ruqya_my_contacts(date);
select 'OK' as result;

-- Undo of 2026-11-wave2.sql (the app works without these functions: no VIP from the server, no «Birləşdir»).
drop function if exists public.ruqya_merge_patients(text[], text);
drop function if exists public.ruqya_patient_marks(integer);
select 'OK' as result;

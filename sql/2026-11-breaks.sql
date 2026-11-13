-- Ruqyatz: a break (prayer, meal) can be set for one specialist instead of everyone. Safe to run more than once.
-- Breaks that exist now stay for everyone (their specialist is empty). Deleting a specialist removes his own breaks.
alter table public.breaks add column if not exists reader_id uuid references public.readers(id) on delete cascade;
create index if not exists breaks_reader_id on public.breaks(reader_id);

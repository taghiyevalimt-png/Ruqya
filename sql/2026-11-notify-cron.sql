-- 24.11.2026 notifications, part 2 (after sql/2026-11-notify.sql and the Edge Function «notify»):
-- every minute the database calls «notify» — only when at least one person has notifications on and a browser to send to.
-- The header carries the secret from private.notify_cfg; the function passes it back to public.ruqya_notify_due.
-- Rollback: sql/rollback-2026-11-notify.sql (unschedules the job first).
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'ruqya-notify';
end $$;
select cron.schedule('ruqya-notify', '* * * * *', $job$
  select net.http_post(
    url := 'https://ldkhdeehrrajvgrtieal.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ruqya-cron', (select cron_secret from private.notify_cfg where id = 1)),
    body := '{}'::jsonb, timeout_milliseconds := 20000)
  where exists (select 1 from public.notify_prefs p join public.push_subs s on s.user_id = p.user_id where p.remind_min is not null or p.on_new)
    and exists (select 1 from private.notify_cfg where id = 1)
$job$);

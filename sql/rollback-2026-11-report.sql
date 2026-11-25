-- Undo of 2026-11-report.sql: the three notice functions as in 2026-11-notify.sql, the report setter and column gone.
drop function if exists public.ruqya_notify_report(boolean, text);
create or replace function public.ruqya_notify_get()
 returns jsonb language sql stable security definer set search_path to ''
as $$
  select jsonb_build_object(
    'remind_min', p.remind_min, 'on_new', coalesce(p.on_new, false),
    'linked', exists (select 1 from private.ruqya_readers_of(auth.uid())),
    'vapid', (select c.vapid_public from private.notify_cfg c where c.id = 1),
    'subs', (select count(*) from public.push_subs s where s.user_id = auth.uid()))
  from (select 1) x left join public.notify_prefs p on p.user_id = auth.uid()
$$;

create or replace function public.ruqya_notify_poll(p_token uuid)
 returns jsonb language plpgsql security definer set search_path to ''
as $$
declare dv public.notify_devices; p public.notify_prefs; since timestamptz; up jsonb := '[]'; nw jsonb := '[]';
begin
  select * into dv from public.notify_devices where token = p_token;
  if not found then return jsonb_build_object('gone', true); end if;
  select * into p from public.notify_prefs where user_id = dv.user_id;
  if found and p.remind_min is not null then
    select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'at', (extract(epoch from private.ruqya_appt_at(a.date, a.time)) * 1000)::bigint,
        'text', private.ruqya_notify_text('r', p.lang, a.date, a.time, a.name, p.remind_min)) order by a.date, a.time), '[]')
      into up from public.appts a
     where a.reader_id in (select private.ruqya_readers_of(dv.user_id)) and a.status <> 'cancel'
       and a.date between (now() at time zone 'Asia/Baku')::date and (now() at time zone 'Asia/Baku')::date + 2
       and private.ruqya_appt_at(a.date, a.time) > now();
  end if;
  if found and p.on_new then
    since := greatest(coalesce(dv.last_poll, now() - interval '20 minutes'), coalesce(p.new_since, now()), now() - interval '1 day');
    select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'text', private.ruqya_notify_text('n', p.lang, a.date, a.time, a.name, 0)) order by a.created_at), '[]')
      into nw from public.appts a
     where a.reader_id in (select private.ruqya_readers_of(dv.user_id)) and a.status <> 'cancel'
       and a.created_at > since and a.created_by is distinct from dv.user_id
       and a.date >= (now() at time zone 'Asia/Baku')::date;
  end if;
  update public.notify_devices set last_poll = now() where token = p_token;
  return jsonb_build_object('remind_min', p.remind_min, 'on_new', coalesce(p.on_new, false), 'upcoming', up, 'news', nw);
end $$;

create or replace function public.ruqya_notify_due(p_secret text)
 returns jsonb language plpgsql security definer set search_path to ''
as $$
declare c private.notify_cfg; msgs jsonb;
begin
  select * into c from private.notify_cfg where id = 1;
  if c.cron_secret is null or p_secret is distinct from c.cron_secret then raise exception 'denied' using errcode = '42501'; end if;
  delete from private.notify_sent where at < now() - interval '14 days';
  with prefs as (
    select p.* from public.notify_prefs p
     where (p.remind_min is not null or p.on_new) and exists (select 1 from public.push_subs s where s.user_id = p.user_id)
  ), due as (
    select p.user_id, a.id appt_id, 'n'::"char" kind, private.ruqya_notify_text('n', p.lang, a.date, a.time, a.name, 0) body
      from prefs p join public.appts a on a.reader_id in (select private.ruqya_readers_of(p.user_id))
     where p.on_new and a.status <> 'cancel' and a.created_by is distinct from p.user_id
       and a.created_at > greatest(p.new_since, now() - interval '1 hour')
       and a.date >= (now() at time zone 'Asia/Baku')::date
    union all
    select p.user_id, a.id, 'r'::"char", private.ruqya_notify_text('r', p.lang, a.date, a.time, a.name, p.remind_min)
      from prefs p join public.appts a on a.reader_id in (select private.ruqya_readers_of(p.user_id))
     where p.remind_min is not null and a.status <> 'cancel'
       and a.date between (now() at time zone 'Asia/Baku')::date and (now() at time zone 'Asia/Baku')::date + 2
       and now() >= private.ruqya_appt_at(a.date, a.time) - make_interval(mins => p.remind_min)
       and now() <  least(private.ruqya_appt_at(a.date, a.time), private.ruqya_appt_at(a.date, a.time) - make_interval(mins => p.remind_min) + interval '15 minutes')
  ), claimed as (
    insert into private.notify_sent (user_id, appt_id, kind) select user_id, appt_id, kind from due
    on conflict do nothing returning user_id, appt_id, kind
  )
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
           'title', 'Mərkəz', 'body', d.body, 'tag', d.kind::text || ':' || d.appt_id::text)), '[]')
    into msgs
    from claimed k join due d on d.user_id = k.user_id and d.appt_id = k.appt_id and d.kind = k.kind
    join public.push_subs s on s.user_id = k.user_id;
  return jsonb_build_object('vapid', jsonb_build_object('public', c.vapid_public, 'private', c.vapid_private, 'subject', c.vapid_subject), 'msgs', msgs);
end $$;

drop function if exists private.ruqya_day_report(text, date);
drop function if exists private.ruqya_admin_id(uuid);
drop function if exists private.ruqya_now();
alter table public.notify_prefs drop column if exists report;
revoke all on function public.ruqya_notify_get(), public.ruqya_notify_poll(uuid), public.ruqya_notify_due(text) from public, anon, authenticated;
grant execute on function public.ruqya_notify_get() to authenticated;
grant execute on function public.ruqya_notify_poll(uuid) to anon, authenticated;
grant execute on function public.ruqya_notify_due(text) to service_role;
select 'OK' as result;

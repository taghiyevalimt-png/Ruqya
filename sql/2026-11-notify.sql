-- 24.11.2026 (owner): «Bildirişlər» in Ayarlar — off for everybody by default. A specialist may turn on:
--   1) a reminder N minutes before each of his sessions (N chosen by him), 2) a notice when a session is booked for him.
-- «His sessions» = the calendar column with his name (the same rule as private.ruqya_my_readers; admins with a column
-- of their own name get them too, agents never).
-- Delivery: Web Push (iPhone home-screen app, computers, Android browsers) — public.push_subs, sent every minute by the
-- Edge Function «notify», which takes its work from public.ruqya_notify_due (service role + the cron secret only);
-- the Android app polls public.ruqya_notify_poll with a device token and sets its own exact alarms.
-- Every notice is sent once (private.notify_sent). Nothing here changes bookings.

create table if not exists public.notify_prefs (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  remind_min integer check (remind_min is null or remind_min between 5 and 1440),
  on_new     boolean not null default false,
  new_since  timestamptz,
  lang       text not null default 'az' check (lang in ('az', 'ru')),
  updated_at timestamptz not null default now()
);
alter table public.notify_prefs enable row level security;
drop policy if exists notify_prefs_own on public.notify_prefs;
create policy notify_prefs_own on public.notify_prefs for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.push_subs (
  endpoint   text primary key check (endpoint like 'https://%' and length(endpoint) < 1000),
  user_id    uuid not null references auth.users (id) on delete cascade,
  p256dh     text not null check (length(p256dh) between 60 and 120),
  auth       text not null check (length(auth) between 16 and 40),
  ua         text,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user on public.push_subs (user_id);
alter table public.push_subs enable row level security;
drop policy if exists push_subs_own on public.push_subs;
create policy push_subs_own on public.push_subs for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.notify_devices (
  token      uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_poll  timestamptz
);
create index if not exists notify_devices_user on public.notify_devices (user_id);
alter table public.notify_devices enable row level security;
drop policy if exists notify_devices_own on public.notify_devices;
create policy notify_devices_own on public.notify_devices for select to authenticated using (user_id = (select auth.uid()));

create table if not exists private.notify_sent (
  user_id uuid not null,
  appt_id uuid not null,
  kind    "char" not null,          -- 'n' new booking, 'r' reminder
  at      timestamptz not null default now(),
  primary key (user_id, appt_id, kind)
);
create table if not exists private.notify_cfg (
  id            integer primary key default 1 check (id = 1),
  cron_secret   text not null,
  vapid_public  text not null,
  vapid_private text not null,
  vapid_subject text not null default 'https://taghiyevalimt-png.github.io/Ruqya/'
);
revoke all on private.notify_sent, private.notify_cfg from public, anon, authenticated;

-- the columns whose sessions are this user's (by name; agents have none)
create or replace function private.ruqya_readers_of(uid uuid)
 returns setof uuid language sql stable security definer set search_path to ''
as $$
  select r.id from public.readers r join public.staff s
    on s.id = uid and coalesce(s.role, '') <> 'agent' and lower(btrim(r.name)) = lower(btrim(s.name))
  where not coalesce(r.archived, false)
$$;
revoke all on function private.ruqya_readers_of(uuid) from public, anon, authenticated;

-- the start of a session as a moment (the calendar is in Baku time)
create or replace function private.ruqya_appt_at(d date, t text)
 returns timestamptz language sql immutable set search_path to ''
as $$ select ((d + (split_part(t, ':', 1) || ':' || split_part(t, ':', 2))::time) at time zone 'Asia/Baku') $$;

-- the text of a notice, in the user's language
create or replace function private.ruqya_notify_text(kind "char", lang text, d date, t text, nm text, mins integer)
 returns text language sql immutable set search_path to ''
as $$
  select case
    when kind = 'n' and lang = 'ru' then 'Вам записали сеанс: ' || extract(day from d)::int || ' ' ||
      (array['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'])[extract(month from d)::int]
      || ', ' || left(t, 5) || ' — ' || coalesce(nm, '')
    when kind = 'n' then 'Sizə seans yazıldı: ' || extract(day from d)::int || ' ' ||
      (array['yanvar','fevral','mart','aprel','may','iyun','iyul','avqust','sentyabr','oktyabr','noyabr','dekabr'])[extract(month from d)::int]
      || ', ' || left(t, 5) || ' — ' || coalesce(nm, '')
    when lang = 'ru' then 'Через ' || case when mins >= 60 and mins % 60 = 0 then (mins / 60) || ' ч' else mins || ' мин' end
      || ' сеанс: ' || left(t, 5) || ' — ' || coalesce(nm, '')
    else case when mins >= 60 and mins % 60 = 0 then (mins / 60) || ' saat' else mins || ' dəqiqə' end
      || ' sonra seans: ' || left(t, 5) || ' — ' || coalesce(nm, '')
  end
$$;

-- ---------- the user's own settings ----------
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

create or replace function public.ruqya_notify_set(p_remind integer, p_new boolean, p_lang text default 'az')
 returns void language plpgsql security definer set search_path to ''
as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_remind is not null and p_remind not between 5 and 1440 then raise exception 'remind_min' using errcode = '22023'; end if;
  insert into public.notify_prefs as p (user_id, remind_min, on_new, new_since, lang, updated_at)
  values (auth.uid(), p_remind, coalesce(p_new, false), case when p_new then now() end,
          case when p_lang = 'ru' then 'ru' else 'az' end, now())
  on conflict (user_id) do update set remind_min = excluded.remind_min, on_new = excluded.on_new,
    new_since = case when excluded.on_new and not p.on_new then now() when excluded.on_new then p.new_since end,
    lang = excluded.lang, updated_at = now();
end $$;

-- ---------- Web Push subscriptions of this user's browsers ----------
create or replace function public.ruqya_push_sub(p_endpoint text, p_p256dh text, p_auth text, p_ua text default null)
 returns void language plpgsql security definer set search_path to ''
as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  insert into public.push_subs (endpoint, user_id, p256dh, auth, ua) values (p_endpoint, auth.uid(), p_p256dh, p_auth, left(p_ua, 200))
  on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua, created_at = now();
  -- at most 10 browsers per person (the oldest go)
  delete from public.push_subs where user_id = auth.uid() and endpoint in
    (select endpoint from public.push_subs where user_id = auth.uid() order by created_at desc offset 10);
end $$;

create or replace function public.ruqya_push_unsub(p_endpoint text)
 returns void language sql security definer set search_path to ''
as $$ delete from public.push_subs where endpoint = p_endpoint and user_id = auth.uid() $$;

-- ---------- the Android app: a device token, then polls with it (also when the app is closed) ----------
create or replace function public.ruqya_notify_device()
 returns uuid language plpgsql security definer set search_path to ''
as $$
declare t uuid;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  delete from public.notify_devices where user_id = auth.uid() and coalesce(last_poll, created_at) < now() - interval '60 days';
  insert into public.notify_devices (user_id) values (auth.uid()) returning token into t;
  return t;
end $$;

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

-- ---------- the sender (Edge Function «notify», every minute): what to send now; each notice only once ----------
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

-- browsers that answered «gone» (404/410) are forgotten
create or replace function public.ruqya_push_gone(p_secret text, p_endpoints text[])
 returns void language plpgsql security definer set search_path to ''
as $$
begin
  if p_secret is distinct from (select cron_secret from private.notify_cfg where id = 1) then raise exception 'denied' using errcode = '42501'; end if;
  delete from public.push_subs where endpoint = any (p_endpoints);
end $$;

-- who may call what
revoke all on function public.ruqya_notify_get(), public.ruqya_notify_set(integer, boolean, text), public.ruqya_push_sub(text, text, text, text),
  public.ruqya_push_unsub(text), public.ruqya_notify_device(), public.ruqya_notify_poll(uuid), public.ruqya_notify_due(text),
  public.ruqya_push_gone(text, text[]) from public, anon, authenticated;
grant execute on function public.ruqya_notify_get(), public.ruqya_notify_set(integer, boolean, text), public.ruqya_push_sub(text, text, text, text),
  public.ruqya_push_unsub(text), public.ruqya_notify_device() to authenticated;
grant execute on function public.ruqya_notify_poll(uuid) to anon, authenticated;
grant execute on function public.ruqya_notify_due(text), public.ruqya_push_gone(text, text[]) to service_role;
revoke all on public.notify_prefs, public.push_subs, public.notify_devices from anon;
revoke insert, update, delete, truncate, references, trigger on public.notify_prefs, public.push_subs, public.notify_devices from authenticated;
grant select on public.notify_prefs, public.push_subs, public.notify_devices to authenticated;

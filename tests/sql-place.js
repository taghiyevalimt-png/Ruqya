// sql/2026-11-place.sql: place column (default ofis), phone takes any text, restore of an old booking gets "ofis".
const { PGlite } = require("@electric-sql/pglite");
const fs = require("fs"), path = require("path");
const rd = (f) => fs.readFileSync(path.join(__dirname, "../sql", f), "utf8");
module.exports = async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create function public.ruqya_is_admin() returns boolean language sql stable as $$ select true $$;
    create table public.appts(id uuid primary key default gen_random_uuid(), date date, time text, duration int, name text, phone text default '', price numeric, share numeric not null default 0, note text default '', status text not null default 'wait', confirmed boolean default false, settled boolean default false, service text default 'Ruqya', created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now());
    create table public.audit_log(id bigint generated always as identity primary key, at timestamptz not null default now(), uid uuid, tbl text not null, op text not null, row_id text, old jsonb, new jsonb);
    grant select, insert, update, delete on public.appts to authenticated;
    insert into appts(id,date,time,duration,name,phone,price) values ('00000000-0000-4000-8000-000000000001',current_date,'10:00',60,'Köhnə','050 111 22 33',130);`);
  await db.exec(rd("2026-11-rules.sql")); await db.exec(rd("2026-11-place.sql")); await db.exec(rd("2026-11-place.sql"));
  const old = (await db.query("select place from appts")).rows[0].place;
  if (old !== "ofis") throw new Error("existing booking becomes ofis: " + old);
  await db.exec("set role authenticated");
  const ins = (ph, pl) => `insert into appts(date,time,duration,name,phone,price,place) values (current_date,'12:00',60,'Ad',${ph},130,${pl})`;
  await db.exec(ins("'yalnız WhatsApp: +7 912'", "'onlayn'"));
  for (const [k, q] of [["empty phone", ins("'  '", "'ofis'")], ["bad place", ins("'050'", "'ev'")]]) {
    let refused = false; try { await db.exec(q); } catch (e) { refused = /Qayda|ruqya_appts_place/.test(e.message); }
    if (!refused) throw new Error("database took: " + k);
  }
  await db.exec("reset role");
  // a booking deleted before the column existed comes back as ofis
  await db.exec(`insert into audit_log(tbl,op,row_id,old) values ('appts','DELETE','00000000-0000-4000-8000-000000000009',
    '{"id":"00000000-0000-4000-8000-000000000009","date":"2026-11-10","time":"11:00","duration":60,"name":"Silinmiş","phone":"050","price":130}')`);
  const id = (await db.query("select id from audit_log where op='DELETE'")).rows[0].id;
  await db.query("select public.ruqya_restore($1)", [id]);
  const r = (await db.query("select place from appts where name='Silinmiş'")).rows[0];
  if (!r || r.place !== "ofis") throw new Error("restored booking has place ofis");
};

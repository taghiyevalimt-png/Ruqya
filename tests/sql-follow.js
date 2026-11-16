// sql/2026-11-follow.sql: any staff member marks a cancelled booking 1-3; other fields of others' bookings stay closed.
const { PGlite } = require("@electric-sql/pglite");
const fs = require("fs"), path = require("path");
const rd = (f) => fs.readFileSync(path.join(__dirname, "../sql", f), "utf8");
module.exports = async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
    create function public.ruqya_is_admin() returns boolean language sql stable as $$ select false $$;
    create table public.appts(id uuid primary key default gen_random_uuid(), date date, name text, status text not null default 'wait', confirmed boolean default false, created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now());
    grant select, insert, update, delete on public.appts to authenticated;
    insert into appts(id,date,name,status,created_by) values
      ('00000000-0000-4000-8000-000000000001',current_date,'Ləğv','cancel','11111111-1111-4111-8111-111111111111'),
      ('00000000-0000-4000-8000-000000000002',current_date,'Aktiv','wait','11111111-1111-4111-8111-111111111111');
    create trigger ruqya_appt_owner before update or delete on public.appts for each row execute function public.ruqya_appt_owner();`.replace("create trigger ruqya_appt_owner", "select 1; -- trigger after function\n--"));
  await db.exec(rd("2026-11-follow.sql")); await db.exec(rd("2026-11-follow.sql"));
  await db.exec("create trigger ruqya_appt_owner before update or delete on public.appts for each row execute function public.ruqya_appt_owner()");
  await db.exec("set test.uid = '22222222-2222-4222-8222-222222222222'; set role authenticated");   // another agent
  await db.exec("update appts set follow = 2 where name = 'Ləğv'");
  const f = (await db.query("select follow from appts where name='Ləğv'")).rows[0].follow;
  if (f !== 2) throw new Error("another agent can mark a cancelled booking");
  for (const [k, q] of [["mark an active booking", "update appts set follow = 1 where name = 'Aktiv'"], ["change others' name", "update appts set name = 'x' where name = 'Ləğv'"], ["value 4", "update appts set follow = 4 where name = 'Ləğv'"]]) {
    let refused = false; try { await db.exec(q); } catch (e) { refused = true; }
    if (!refused) throw new Error("database took: " + k);
  }
  await db.exec("reset role");
  await db.exec(rd("rollback-2026-11-follow.sql"));
};

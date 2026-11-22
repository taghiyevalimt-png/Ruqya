// sql/2026-11-anonymize.sql on a real PostgreSQL: no trace of the patient left, sessions kept, only admins.
let PGlite; try { ({ PGlite } = require("@electric-sql/pglite")); } catch (e) { ({ PGlite } = require("./pglite-pg")); }   // audit 6: stand-in when npm is not available
const fs = require("fs"), path = require("path");
const rd = (f) => fs.readFileSync(path.join(__dirname, "../sql", f), "utf8");
module.exports = async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
    create function public.ruqya_is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('test.admin', true),'') = '1' $$;
    create table public.appts(id uuid primary key default gen_random_uuid(), reader_id uuid, date date, time text, name text, phone text default '', price numeric default 130, note text default '', status text not null default 'wait', created_by uuid);
    create table public.audit_log(id bigint generated always as identity primary key, at timestamptz not null default now(), uid uuid, tbl text not null, op text not null, row_id text, old jsonb, new jsonb);
    create function public.audit() returns trigger language plpgsql as $$ begin
      insert into public.audit_log(uid,tbl,op,row_id,old,new) values (auth.uid(), tg_table_name, tg_op, coalesce(new.id,old.id)::text,
        case when tg_op<>'INSERT' then to_jsonb(old) end, case when tg_op<>'DELETE' then to_jsonb(new) end); return null; end $$;
    create trigger a after insert or update or delete on public.appts for each row execute function public.audit();`);
  await db.exec(rd("2026-11-patients.sql")); await db.exec(rd("2026-11-anonymize.sql")); await db.exec(rd("2026-11-anonymize.sql"));
  await db.exec(`insert into appts(date,time,name,phone,note) values (current_date,'10:00','Ali Veli','050 111 22 33','gizli qeyd'),
      (current_date-300,'11:00','Ali V.','+994501112233',''),(current_date-10,'12:00','Ali Veli','0501112233','silinəcək'),(current_date,'13:00','Başqa','055 000 00 00','');
    update appts set note='dəyişdi' where time='11:00'; delete from appts where time='12:00';`);
  let refused = false;
  try { await db.exec("select public.ruqya_anonymize('p501112233')"); } catch (e) { refused = /Yalniz admin/.test(e.message); }
  if (!refused) throw new Error("non-admin must be refused");
  await db.exec("set test.admin = '1'; set test.uid = 'bad097d4-5edc-402b-ad59-f633252c35d9'");
  const n = (await db.query("select public.ruqya_anonymize('p501112233') n")).rows[0].n;
  if (n !== 3) throw new Error("3 bookings (2 kept + 1 deleted) expected, got " + n);
  const all = JSON.stringify((await db.query("select * from appts")).rows) + JSON.stringify((await db.query("select * from audit_log")).rows);
  for (const t of ["Ali", "111 22 33", "501112233", "gizli", "silinəcək", "dəyişdi"]) if (all.includes(t)) throw new Error("left behind: " + t);
  if (!all.includes("Başqa")) throw new Error("other patients untouched");
  const kept = (await db.query("select count(*)::int c, sum(price)::int s from appts where name='Anonim'")).rows[0];
  if (kept.c !== 2 || kept.s !== 260) throw new Error("sessions and money stay: " + JSON.stringify(kept));
  const mark = (await db.query("select new from audit_log where op='ANON'")).rows;
  if (mark.length !== 1 || mark[0].new.count !== 3) throw new Error("one journal line about it");
};

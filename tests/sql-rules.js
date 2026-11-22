// sql/2026-11-rules.sql: the form's rules hold in the database too, old rows stay editable in other fields.
let PGlite; try { ({ PGlite } = require("@electric-sql/pglite")); } catch (e) { ({ PGlite } = require("./pglite-pg")); }   // audit 6: stand-in when npm is not available
const fs = require("fs"), path = require("path");
module.exports = async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create table public.appts(id uuid primary key default gen_random_uuid(), date date, time text, duration int, name text, phone text default '', price numeric, note text default '', confirmed boolean default false);
    grant select, insert, update, delete on public.appts to authenticated;
    insert into appts(id,date,time,duration,name,phone,price) values ('00000000-0000-4000-8000-000000000001',current_date,'23:30',90,'Köhnə','',0);`);
  await db.exec(fs.readFileSync(path.join(__dirname, "../sql/2026-11-rules.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(__dirname, "../sql/2026-11-rules.sql"), "utf8"));
  await db.exec("set role authenticated");
  const ok = "insert into appts(date,time,duration,name,phone,price) values (current_date,'10:00',60,'Ad','050 111 22 33',130)";
  await db.exec(ok);
  const bad = {
    "empty name": ok.replace("'Ad'", "'  '"), "short phone": ok.replace("050 111 22 33", "12345"), "zero price": ok.replace(",130)", ",0)"),
    "15 min": ok.replace(",60,", ",15,"), "07:00": ok.replace("10:00", "07:00"), "past midnight": ok.replace("'10:00',60", "'23:30',60"),
  };
  for (const [k, q] of Object.entries(bad)) {
    let refused = false; try { await db.exec(q); } catch (e) { refused = /Qayda/.test(e.message); }
    if (!refused) throw new Error("database took: " + k);
  }
  // an old booking that breaks today's rules can still be confirmed and have its note changed
  await db.exec("update appts set confirmed = true, note = 'x' where id = '00000000-0000-4000-8000-000000000001'");
  let refused = false; try { await db.exec("update appts set price = 0 where name = 'Ad'"); } catch (e) { refused = true; }
  if (!refused) throw new Error("price change to 0 must be refused");
  await db.exec("reset role");
  await db.exec(fs.readFileSync(path.join(__dirname, "../sql/rollback-2026-11-rules.sql"), "utf8"));
};

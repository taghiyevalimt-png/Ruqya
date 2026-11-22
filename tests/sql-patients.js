// Runs sql/2026-11-patients.sql on a real PostgreSQL (PGlite) and checks that its patient key equals the app's.
let PGlite; try { ({ PGlite } = require("@electric-sql/pglite")); } catch (e) { ({ PGlite } = require("./pglite-pg")); }   // audit 6: stand-in when npm is not available
const fs = require("fs"), path = require("path");
const jsKey = (phone, name) => { const d = String(phone || "").replace(/\D/g, ""); return d.length >= 7 ? "p" + d.slice(-9) : "n" + String(name || "").trim().toLowerCase().replace(/̇/g, "").replace(/ı/g, "i"); };
module.exports = async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create table public.appts(id uuid primary key default gen_random_uuid(), reader_id uuid, date date, time text, name text, phone text, status text not null default 'wait', created_by uuid);`);
  await db.exec(fs.readFileSync(path.join(__dirname, "../sql/2026-11-patients.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(__dirname, "../sql/2026-11-patients.sql"), "utf8")); // runs twice safely
  const cases = [["+994 50 111 22 33", "A"], ["0501112233", "B"], ["(050) 111-22-33", "C"], ["", "İsmayıl Əliyev"], [null, "  ISMAYIL  "], ["12345", "Rəna"], ["+7 912 345 67 89", "Olga"]];
  for (const [ph, nm] of cases) {
    const r = await db.query("select public.ruqya_pkey($1,$2) k", [ph, nm]);
    if (r.rows[0].k !== jsKey(ph, nm)) throw new Error("key differs for " + ph + " / " + nm + ": sql " + r.rows[0].k + " js " + jsKey(ph, nm));
  }
  await db.exec(`insert into appts(date,time,name,phone,status) values
    (current_date-100,'10:00','Ali','+994 50 111 22 33','wait'),(current_date-120,'10:00','Ali Old','050 111 22 33','noshow'),
    (current_date-130,'10:00','Ali','0501112233','cancel'),(current_date-5,'10:00','Ali','0501112233','wait'),(current_date-900,'10:00','Ali','0501112233','wait')`);
  const g = (await db.query("select * from public.ruqya_hist_patients(current_date-45, current_date-731)")).rows;
  if (g.length !== 1) throw new Error("one patient expected, got " + JSON.stringify(g));
  const x = g[0];
  if (x.n !== 1 || x.noshow !== 1 || x.cancel !== 1 || x.name !== "Ali") throw new Error("counts/name wrong " + JSON.stringify(x));
  const v = (await db.query("select * from public.ruqya_hist_visits('p501112233', current_date-45, current_date-731)")).rows;
  if (v.length !== 3) throw new Error("3 old visits expected, got " + v.length);
  // B-04: with ORDER BY, two pages read with LIMIT/OFFSET give every patient exactly once
  await db.exec(fs.readFileSync(path.join(__dirname, "../sql/2026-11-patients-order.sql"), "utf8"));
  await db.exec("insert into appts(date,time,name,phone,status) select current_date-100-(g%200),'10:00','P'||g,'055'||(1000000+g),'wait' from generate_series(1,2500) g");
  const p1 = (await db.query("select k from public.ruqya_hist_patients(current_date-45, current_date-731) limit 1000 offset 0")).rows.map((r) => r.k);
  const p2 = (await db.query("select k from public.ruqya_hist_patients(current_date-45, current_date-731) limit 1000 offset 1000")).rows.map((r) => r.k);
  const p3 = (await db.query("select k from public.ruqya_hist_patients(current_date-45, current_date-731) limit 1000 offset 2000")).rows.map((r) => r.k);
  const all = new Set([...p1, ...p2, ...p3]);
  if (all.size !== p1.length + p2.length + p3.length || all.size !== 2501) throw new Error("paging overlaps or skips: " + all.size);
  await db.exec(fs.readFileSync(path.join(__dirname, "../sql/rollback-2026-11-patients-order.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(__dirname, "../sql/rollback-2026-11-patients.sql"), "utf8"));
};

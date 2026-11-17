// Owner 17.11 (sql/2026-11-service.sql): a booking is written with one of six services; anything else is refused by
// the database; an old booking with an older value is still editable in other fields; the rollback works.
const fs = require("fs"), path = require("path");
const { start } = require("../localpg"), { build, as } = require("../dbcopy"), { check } = require("../lib");
module.exports = async () => {
  const pg = await start(54355); let c;
  try {
    c = await build(pg, "service");
    const ins = (svc) => "insert into public.appts (id, reader_id, date, time, duration, name, phone, price, share, status, note, created_by, service) values (gen_random_uuid(), 'b0000000-0000-4000-8000-000000000001', current_date + 3, '15:00', 60, 'Xidmət test', '050 1', 130, 0, 'wait', '', 'a0000000-0000-4000-8000-0000000000aa', " + svc + ")";
    for (const v of ["Ruqya", "Hicama", "Kombo", "Masaj", "Dr.Günel", "Psixoloq"]) {
      const r = await as(c, "agentA", ins("'" + v + "'")); check(r.ok, "service «" + v + "» is accepted: " + (r.ok ? "ok" : r.error));
    }
    const def = await as(c, "agentA", ins("default")); check(def.ok, "no service given: the default (Ruqya) is accepted: " + (def.ok ? "ok" : def.error));
    const bad = await as(c, "agentA", ins("'Bilinməyən'")); check(!bad.ok && bad.code === "23514", "another service is refused: " + (bad.ok ? "accepted" : bad.code));
    // an old booking with an older value: its note can still be changed
    await c.query("update public.appts set service = 'Ruqyə' where id = 'c0000000-0000-4000-8000-000000000003'");
    const old = await as(c, "agentA", "update public.appts set note = 'yeni' where id = 'c0000000-0000-4000-8000-000000000003'");
    check(old.ok && old.rowCount === 1, "an old booking with an older service value stays editable: " + (old.ok ? old.rowCount : old.error));
    const chg = await as(c, "agentA", "update public.appts set service = 'Bilinməyən' where id = 'c0000000-0000-4000-8000-000000000003'");
    check(!chg.ok, "changing it to an unknown service is refused");
    // rollback: no service check any more
    await c.query(fs.readFileSync(path.join(__dirname, "..", "..", "sql", "rollback-2026-11-service.sql"), "utf8"));
    const after = await as(c, "agentA", ins("'Bilinməyən'")); check(after.ok, "after the rollback any service is accepted again: " + (after.ok ? "ok" : after.error));
  } finally { if (c) await c.end().catch(() => {}); await pg.stop(); }
};

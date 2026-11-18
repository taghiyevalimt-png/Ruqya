// Owner 18.11 (sql/2026-11-my-contacts.sql): ruqya_my_contacts gives the caller the name and phone of the patients he
// wrote himself (two years, one row per patient, latest name), nobody else's; not callable without sign-in; rollback.
const fs = require("fs"), path = require("path");
const { start } = require("../localpg"), { build, as, R } = require("../dbcopy"), { check } = require("../lib");
module.exports = async () => {
  const pg = await start(54372); let c;
  try {
    c = await build(pg, "mycontacts");
    const ins = (by, name, phone, off) => c.query("insert into public.appts (id, reader_id, date, time, duration, name, phone, price, share, status, note, created_by) values (gen_random_uuid(), $1, current_date + $2::int, '15:00', 30, $3, $4, 130, 0, 'wait', '', $5)", [R.bos, off, name, phone, by]);
    await c.query("set session_replication_role = replica");
    await ins("a0000000-0000-4000-8000-0000000000aa", "Köhnə Pasiyent", "050 700 00 01", -300);
    await ins("a0000000-0000-4000-8000-0000000000aa", "Köhnə Pasiyent Yeni Ad", "050 700 00 01", -10);
    await ins("a0000000-0000-4000-8000-0000000000aa", "Nömrəsiz", "", -5);
    await ins("a0000000-0000-4000-8000-0000000000ab", "B-nin Pasiyenti", "050 700 00 02", -20);
    await c.query("set session_replication_role = origin");
    const q = "select name, phone from public.ruqya_my_contacts(current_date - 731)";
    const a = await as(c, "agentA", q);
    const names = a.ok ? a.rows.map((r) => r.name + "/" + r.phone) : a.error;
    check(a.ok && names.includes("Köhnə Pasiyent Yeni Ad/050 700 00 01") && !names.some((x) => /Köhnə Pasiyent\//.test(x)), "agent A: his old patient once, with the latest name: " + JSON.stringify(names));
    check(a.ok && !names.some((x) => /B-nin|Nömrəsiz/.test(x)), "agent A: not agent B's patient, not a patient without a number: " + JSON.stringify(names));
    const b = await as(c, "agentB", q);
    check(b.ok && b.rows.some((r) => r.name === "B-nin Pasiyenti") && !b.rows.some((r) => /Köhnə/.test(r.name)), "agent B: only his own: " + JSON.stringify(b.ok ? b.rows : b.error));
    const anon = await as(c, "anon", q); check(!anon.ok, "without sign-in: refused: " + (anon.ok ? "allowed" : anon.code));
    const pend = await as(c, "pending", q); check(pend.ok && pend.rows.length === 0, "a person without a role gets nothing");
    await c.query(fs.readFileSync(path.join(__dirname, "..", "..", "sql", "rollback-2026-11-my-contacts.sql"), "utf8"));
    const gone = await as(c, "agentA", q); check(!gone.ok, "after the rollback the function is gone");
  } finally { if (c) await c.end().catch(() => {}); await pg.stop(); }
};

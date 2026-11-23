// 23.11 (sql/2026-11-presets.sql): everybody with a role reads the prices and lengths of a new booking; only admins
// write them; a person without a role and a visitor without sign-in see nothing; the row is seeded with the values the
// app had in its code (İlkin 90 min / 150 ₼); the change is in the journal; rollback removes the table.
const fs = require("fs"), path = require("path");
const { start } = require("../localpg"), { build, as, R } = require("../dbcopy"), { check } = require("../lib");
module.exports = async () => {
  const pg = await start(54381); let c;
  try {
    c = await build(pg, "presets");
    // the copy's specialists are created after the migration ran: seed again the way the migration does (İlkin by name)
    await c.query("delete from public.app_settings");
    await c.query(fs.readFileSync(path.join(__dirname, "..", "..", "sql", "2026-11-presets.sql"), "utf8"));
    let r = await as(c, "spec", "select value from public.app_settings where id = 'presets'");
    check(r.ok && r.rows.length === 1, "a specialist reads the presets: " + (r.ok ? r.rows.length : r.error));
    const v = r.ok && r.rows[0] && r.rows[0].value; const val = typeof v === "string" ? JSON.parse(v) : v;
    check(val && val.price === 130 && JSON.stringify(val.svc.Masaj) === "[60,80]", "seeded with the app's old values: " + JSON.stringify(val));
    check(val && JSON.stringify(val.reader[R.ilkin]) === "[90,150]", "İlkin found by name: " + JSON.stringify(val && val.reader));
    r = await as(c, "agentA", "select 1 from public.app_settings"); check(r.ok && r.rows.length === 1, "an agent reads");
    r = await as(c, "pending", "select 1 from public.app_settings"); check(r.ok && r.rows.length === 0, "a person without a role reads nothing");
    r = await as(c, "anon", "select 1 from public.app_settings"); check(!r.ok, "without sign-in: refused");
    r = await as(c, "agentA", "update public.app_settings set value = '{\"price\":1}' where id = 'presets'"); check(r.ok && r.rowCount === 0, "an agent changes nothing");
    r = await as(c, "spec", "insert into public.app_settings (id, value) values ('presets', '{}') on conflict (id) do update set value = excluded.value");
    check(!r.ok, "a specialist cannot write (upsert)");
    r = await as(c, "agentA", "delete from public.app_settings"); check(r.ok && r.rowCount === 0, "an agent deletes nothing");
    r = await as(c, "admin2", "insert into public.app_settings (id, value) values ('presets', '{\"price\":140}') on conflict (id) do update set value = excluded.value returning id");
    check(r.ok && r.rowCount === 1, "an admin saves (the app's upsert): " + (r.ok ? r.rowCount : r.error));
    r = await as(c, "admin2", "insert into public.app_settings (id, value) values ('other', '{}')"); check(!r.ok, "only the row «presets» exists");
    r = await as(c, "admin2", "update public.app_settings set value = '[1]' where id = 'presets'"); check(!r.ok, "the value must be an object");
    const j = await c.query("select count(*)::int n from public.audit_log where tbl = 'app_settings'");
    check(j.rows[0].n >= 1, "the change is in the journal: " + j.rows[0].n);
    await c.query(fs.readFileSync(path.join(__dirname, "..", "..", "sql", "rollback-2026-11-presets.sql"), "utf8"));
    const g = await c.query("select to_regclass('public.app_settings') t"); check(g.rows[0].t === null, "rollback removes the table");
  } finally { if (c) await c.end().catch(() => {}); await pg.stop(); }
};

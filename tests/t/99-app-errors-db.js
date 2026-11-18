// Stability audit 2 (sql/2026-11-app-errors.sql): every signed-in person writes his own errors; only admins read and
// delete; nobody writes in another's name; no access without sign-in; at most 100 an hour per person; rollback.
const fs = require("fs"), path = require("path");
const { start } = require("../localpg"), { build, as, U } = require("../dbcopy"), { check } = require("../lib");
module.exports = async () => {
  const pg = await start(54374); let c;
  try {
    c = await build(pg, "apperrors");
    const ins = (m, uid) => "insert into public.app_errors (m, v, tab" + (uid ? ", uid" : "") + ") values ('" + m + "', '20261118', 'day'" + (uid ? ", '" + uid + "'" : "") + ")";
    let r = await as(c, "agentA", ins("agent xətası")); check(r.ok && r.rowCount === 1, "an agent writes his error: " + (r.ok ? r.rowCount : r.error));
    r = await as(c, "spec", ins("spec xətası")); check(r.ok, "a specialist writes his error: " + (r.ok ? "ok" : r.error));
    r = await as(c, "pending", ins("pending xətası")); check(r.ok, "a person without a role writes his error too: " + (r.ok ? "ok" : r.error));
    r = await as(c, "agentA", ins("başqasının adına", U.agentB)); check(!r.ok, "nobody writes in another's name");
    r = await as(c, "anon", ins("anon")); check(!r.ok, "without sign-in: refused");
    await c.query("insert into public.app_errors (m, uid) values ('saved 1', '" + U.agentA + "'), ('saved 2', '" + U.spec + "')");
    r = await as(c, "agentA", "select m from public.app_errors"); check(r.ok && r.rows.length === 0, "an agent reads nothing: " + (r.ok ? r.rows.length : r.error));
    r = await as(c, "admin2", "select m from public.app_errors"); check(r.ok && r.rows.length === 2, "an admin reads all errors: " + (r.ok ? r.rows.length : r.error));
    r = await as(c, "agentA", "delete from public.app_errors"); check(r.ok && r.rowCount === 0, "an agent deletes nothing");
    r = await as(c, "owner", "delete from public.app_errors where m = 'saved 1'"); check(r.ok && r.rowCount === 1, "an admin deletes");
    r = await as(c, "agentA", "insert into public.app_errors (m) values ('" + "x".repeat(401) + "')"); check(!r.ok, "a too long message is refused");
    // the hourly limit
    await c.query("insert into public.app_errors (m, uid) select 'flood', '" + U.agentB + "' from generate_series(1, 100)");
    r = await as(c, "agentB", ins("101-ci")); check(!r.ok, "the 101st error of the hour is refused: " + (r.ok ? "accepted" : r.code));
    await c.query(fs.readFileSync(path.join(__dirname, "..", "..", "sql", "rollback-2026-11-app-errors.sql"), "utf8"));
    r = await as(c, "agentA", ins("sonra")); check(!r.ok, "after the rollback the table is gone");
  } finally { if (c) await c.end().catch(() => {}); await pg.stop(); }
};

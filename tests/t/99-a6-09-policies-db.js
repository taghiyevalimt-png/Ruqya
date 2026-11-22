// A6-09 (audit 6, Supabase Advisors «multiple permissive policies», 12 warnings): one permissive policy per table, role
// and action (they are joined with OR anyway, so the rights stay the same — the full access matrix, test 21, is the
// proof). Here: (1) no table has two permissive policies for the same action; (2) the rollback brings the previous
// policies back and the matrix is still the same; (3) the migration can run again.
const fs = require("fs"), path = require("path");
const { start } = require("../localpg"), { build, as } = require("../dbcopy"), { ROLES, M } = require("../access-matrix"), { check } = require("../lib");
const dup = `select c.relname || ':' || a.cmd x from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace,
  lateral (select unnest(case p.polcmd when '*' then array['r','a','w','d'] else array[p.polcmd::text] end) cmd) a
  where n.nspname = 'public' and p.polpermissive group by c.relname, a.cmd having count(*) > 1 order by 1`;
async function matrix(c) { const out = []; for (const [t, ops] of Object.entries(M)) for (const [op, [sql]] of Object.entries(ops)) for (const who of ROLES) { const r = await as(c, who, sql); out.push(t + op + who + (r.ok && (op === "INSERT" || r.rowCount > 0) ? 1 : 0)); } return out.join(","); }
module.exports = async () => {
  const pg = await start(54363); let c;
  const sql = (f) => fs.readFileSync(path.join(__dirname, "..", "..", "sql", f), "utf8");
  try {
    c = await build(pg, "onepolicy");
    const d1 = (await c.query(dup)).rows.map((r) => r.x);
    check(d1.length === 0, "one permissive policy per table and action: " + d1.join(" "));
    const m1 = await matrix(c);
    await c.query(sql("rollback-2026-11-a6-one-policy.sql"));
    const d2 = (await c.query(dup)).rows.map((r) => r.x);
    check(d2.length >= 12, "the rollback brings the previous policies back (" + d2.length + " doubled table-actions)");
    check(await matrix(c) === m1, "the same rights after the rollback");
    await c.query(sql("2026-11-a6-one-policy.sql"));
    check((await c.query(dup)).rows.length === 0 && await matrix(c) === m1, "the migration runs again, same rights");
  } finally { if (c) await c.end().catch(() => {}); await pg.stop(); }
};

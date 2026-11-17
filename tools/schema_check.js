#!/usr/bin/env node
// Is the database fully described by this repository? Builds an empty PostgreSQL 17 from db/schema_live_*.sql
// (as tests/dbcopy.js does) and compares the structure fingerprint (scripts/backup-structure.sql) with a
// fingerprint taken from the live database (read-only). Then applies the pending migrations of tests/dbcopy.js
// (AFTER) and lists which parts they change — exactly those must differ, nothing else.
//   node tools/schema_check.js <live-fingerprint.tsv> [port]
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const { start } = require(path.join(ROOT, "tests", "localpg"));
const { build } = require(path.join(ROOT, "tests", "dbcopy"));
const Q = fs.readFileSync(path.join(ROOT, "scripts", "backup-structure.sql"), "utf8");
const read = (f) => Object.fromEntries(fs.readFileSync(f, "utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => { const i = l.indexOf("\t"); return [l.slice(0, i), l.slice(i + 1)]; }));
async function fp(c) { const r = await c.query(Q); return Object.fromEntries(r.rows.map((x) => Object.values(x))); }
(async () => {
  const live = read(process.argv[2]), port = +process.argv[3] || 54350;
  const pg = await start(port); let c, bad = 0;
  try {
    c = await build(pg, "schemacheck", { after: [] });
    const dump = await fp(c);
    console.log("# repository schema (db/schema_live_*.sql + BASE install files) vs live — " + new Date().toISOString());
    for (const k of Object.keys(live)) { const ok = dump[k] === live[k]; if (!ok) bad++; console.log((ok ? "SAME  " : "DIFFER") + "\t" + k + (ok ? "" : "\trepo=" + dump[k] + "\tlive=" + live[k])); }
    await c.end(); c = await build(pg, "schemacheck2");
    const after = await fp(c);
    console.log("# what the pending migrations change (tests/dbcopy.js AFTER):");
    for (const k of Object.keys(live)) if (after[k] !== dump[k]) console.log("CHANGED\t" + k);
  } finally { if (c) await c.end().catch(() => {}); await pg.stop(); }
  console.log(bad ? "НЕ ПРОЙДЕНО: " + bad + " parts differ" : "ПРОЙДЕНО: the repository schema equals the live structure in every part");
  process.exit(bad ? 1 : 0);
})();

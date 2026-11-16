// Direct database requests that try to get around the app (tests/attacks.js), on a copy of the live structure.
// ATTACKS_OUT=<file> writes each attempt with its result.
const fs = require("fs"), path = require("path");
const { start } = require("../localpg"), { build, as } = require("../dbcopy"), { ATTACKS } = require("../attacks");
module.exports = async () => {
  const pg = await start(54333); let c;
  const lines = [], bad = [];
  try {
    c = await build(pg, "attacks");
    for (const [id, what, who, sql, safe] of ATTACKS) {
      const r = await as(c, who, sql);
      const ok = !!safe(r);
      const line = [id, who, ok ? "BLOCKED" : "SUCCEEDED (data not safe)", what, r.ok ? "rows " + r.rowCount : "error " + r.code + " " + String(r.error).slice(0, 120)].join("\t");
      lines.push(line); if (!ok) bad.push(line);
    }
    const out = process.env.ATTACKS_OUT;
    if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, "# attacks on copy — " + new Date().toISOString() + "\n# attempts: " + lines.length + ", got through: " + bad.length + "\n" + lines.join("\n") + "\n"); }
    if (bad.length) throw new Error(bad.length + " attacks got through:\n    " + bad.join("\n    "));
  } finally { if (c) await c.end().catch(() => {}); await pg.stop(); }
};

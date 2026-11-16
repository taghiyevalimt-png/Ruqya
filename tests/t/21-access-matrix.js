// Every cell of the access matrix (tests/access-matrix.js) as a real request on a copy of the live structure.
// MATRIX_OUT=<file> writes every cell with its result.
const fs = require("fs"), path = require("path");
const { start } = require("../localpg"), { build, as } = require("../dbcopy"), { ROLES, M } = require("../access-matrix");
module.exports = async () => {
  const pg = await start(54331); let c;
  const lines = [], bad = [];
  try {
    c = await build(pg, "matrix");
    let cells = 0;
    for (const ops of Object.values(M)) cells += Object.keys(ops).length * ROLES.length;
    for (const [t, ops] of Object.entries(M)) for (const [op, [sql, want]] of Object.entries(ops)) for (let i = 0; i < ROLES.length; i++) {
      const r = await as(c, ROLES[i], sql);
      const got = r.ok && (op === "INSERT" || r.rowCount > 0) ? 1 : 0;
      const line = [t, op, ROLES[i], "expected " + (want[i] ? "ALLOW" : "DENY"), "got " + (got ? "ALLOW" : "DENY"), got === want[i] ? "OK" : "MISMATCH", r.ok ? "rows " + r.rowCount : "error " + r.code + " " + r.error].join("\t");
      lines.push(line); if (got !== want[i]) bad.push(line);
    }
    const out = process.env.MATRIX_OUT;
    if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, "# access matrix on copy — " + new Date().toISOString() + "\n# cells: " + cells + ", checked: " + lines.length + ", mismatches: " + bad.length + "\n" + lines.join("\n") + "\n"); }
    if (lines.length !== cells) throw new Error("checked " + lines.length + " of " + cells + " cells");
    if (bad.length) throw new Error(bad.length + " mismatches:\n    " + bad.join("\n    "));
  } finally { if (c) await c.end().catch(() => {}); await pg.stop(); }
};

// Audit 6: the defects fixed in this audit put back one at a time (index.html, CSP recomputed); each must be caught
// by its test. Same method as tests/mutate-app.js and tests/a5/mutate-a5.js. Run in a separate worktree:
//   node tests/a6/mutate-a6.js [out.txt]
const fs = require("fs"), path = require("path"), { execFileSync, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..", ".."), FILE = path.join(ROOT, "index.html"), PY = process.env.PYTHON || "python3";
const M = [
  ["M6-01", "A6-01 back: a 5xx of the sign-in server signs out", "if(!r||r.status<500||", "if(true||!r||r.status<500||", ["99-a6-01-auth500"]],
  ["M6-02", "A6-02 back: a cut connection shown as a program error and sent", "if(NETERR.test(m)){", "if(false){", ["99-a6-02-net-errors"]],
  ["M6-03", "A6-03 back: Baku = fixed +4", "function tzAt(t){var h=Math.floor(t/3600000);", "function tzAt(t){return TZ;var h=Math.floor(t/3600000);", ["99-a6-03-timezone"]],
  ["M6-04", "A6-06 back: left-out days grow without limit", "return (l||[]).concat([d]).filter(", "return (l||[]).concat([d]);(l||[]).filter(", ["99-a6-06-break-skip"]],
  ["M6-05", "A6-10 back: the staff form is lost on a failed save", "if(!sheet&&isAdmin()&&sk in state.staff)openSheet(", "if(false)openSheet(", ["99-a6-10-staff-reopen"]],
  ["M6-06", "S-09 switch ignored: 12 hours does nothing", "var IDLE_MS=(IDLE_12H?12:7*24)*3600e3", "var IDLE_MS=(false?12:7*24)*3600e3", ["99-a6-11-idle-12h"]],
];
const orig = fs.readFileSync(FILE), lines = [];
try {
  for (const [id, what, from, to, tests] of M) {
    const s = orig.toString("utf8"), n = s.split(from).length - 1;
    if (n !== 1) { lines.push([id, "NOT APPLIED (code found " + n + " times)", what].join("\t")); console.log(lines[lines.length - 1]); continue; }
    fs.writeFileSync(FILE, s.replace(from, to)); execFileSync(PY, [path.join(ROOT, "tools", "csp.py")], { stdio: "pipe" });
    const failed = [];
    for (const t of tests) { const r = spawnSync(process.execPath, [path.join(ROOT, "tests", "run.js"), t], { encoding: "utf8", cwd: path.join(ROOT, "tests") }); if (r.status !== 0) failed.push(t); }
    lines.push([id, failed.length ? "CAUGHT by " + failed.join(",") : "SURVIVED (" + tests.join(",") + " passed)", what].join("\t"));
    console.log(lines[lines.length - 1]); fs.writeFileSync(FILE, orig);
  }
} finally { fs.writeFileSync(FILE, orig); }
const caught = lines.filter((l) => l.includes("CAUGHT")).length;
const out = "# audit 6 mutations — " + new Date().toISOString() + "\n" + lines.join("\n") + "\ncaught " + caught + " of " + M.length + "\n";
if (process.argv[2]) fs.writeFileSync(process.argv[2], out);
console.log("caught " + caught + " of " + M.length); process.exit(caught === M.length ? 0 : 1);

// Audit 5, stage 4: are the new tests able to catch the defects of this audit coming back? Same method as
// tests/mutate-app.js (T-52): one realistic defect per run into index.html (CSP hashes recomputed), the tests that
// should notice it, then the original file back. CAUGHT = at least one of those tests fails.
// node tests/a5/mutate-a5.js [out.txt]   (run it in a separate worktree: it rewrites index.html while it runs)
const fs = require("fs"), path = require("path"), { execFileSync, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..", ".."), FILE = path.join(ROOT, "index.html"), PY = process.env.PYTHON || "python3";
const M = [
  ["M5-01", "A5-K1 back: the sale date comes from the day open in Kassa", "value=\"'+esc(x.date||today)+'\"></div><div></div></div>", "value=\"'+esc(x.date||ui.date)+'\"></div><div></div></div>", ["99-a5-k1-sale-date"]],
  ["M5-02", "error check removed in db() (server error looks saved)", "if(r.error){bad();flash(dbMsg(r.error),true);return refresh()}", "if(r.error){}", ["99-cash-save-fail"]],
  ["M5-03", "A5-05 back: 0 changed rows looks saved", "if(Array.isArray(r.data)&&!r.data.length){bad();", "if(false){bad();", ["99-a5-05-zero-rows"]],
  ["M5-04", "A5-06 back: a passing load error = «no table» (0 sales)", "if(noTable(e))return null;throw e", "return null", ["99-a5-06-soft-fail"]],
  ["M5-05", "A5-K3 back: a patient = the phone only (relatives glued)", 'return d.length>=7?"p"+d+"|"+n:"n"+n', 'return d.length>=7?"p"+d:"n"+n', ["99-a5-k3-patients"]],
  ["M5-06", "A5-K2 back: ə no longer folded to e in search", 'var FOLD={"\\u0259":"e"', 'var FOLD={"\\u0259":"\\u0259"', ["99-a5-k2-search"]],
  ["M5-07", "A5-03 back: a retried booking gets a new id (duplicate)", "var id=sheet.nid||uuid();dsh.nid=id", "var id=uuid();dsh.nid=id", ["99-a5-03-retry-no-dup"]],
  ["M5-08", "A5-03 back: a retried sale gets new ids (duplicate)", "id:o&&o.q===q&&o.d===sdt?o.id:uuid()", "id:uuid()", ["99-a5-03-retry-no-dup"]],
  ["M5-09", "A5-04 back: the unsaved sale is not kept on the phone", "sellDraft(keepS);sellPend++;", "sellPend++;", ["99-a5-03-retry-no-dup"]],
  ["M5-10", "A5-07 back: a retried expense is a second row", "var xid=sheet.nid||uuid();", "var xid=uuid();", ["99-a5-07-retry-changed"]],
  ["M5-11", "week boundary moved (Saturday–Friday instead of Friday–Thursday)", "function friOf(d){return addDays(d,-((parse(d).getDay()-5+7)%7))}", "function friOf(d){return addDays(d,-((parse(d).getDay()-6+7)%7))}", ["99-current-period", "99-stats-merged", "99-a5-week-bounds"]],
  ["M5-12", "A5-02 back: an admin with nothing written shows «·»", "isSpec(k)?null:{k:k,a:0,b:0,d:0,w:null,s:null,t:null}", "null", ["99-a5-02-zero"], true],
  ["M5-13", "A5-12 back: a full storage loses the draft", 'catch(e){try{localStorage.removeItem(CK);lastCacheJs="";localStorage.setItem(k,v)}catch(e2){}}', "catch(e){}", ["99-a5-12-quota"]],
  ["M5-14", "A5-09 back: a failed load of old patients is silent", "if(my===seq){render();setTimeout(ensureHist,20500)}", "if(false){}", ["99-a5-09-hist-fail"]],
];
const orig = fs.readFileSync(FILE), lines = [];
try {
  for (const [id, what, from, to, tests, all] of M) {
    const s = orig.toString("utf8"), n = s.split(from).length - 1;
    if (n < 1 || (n > 1 && !all)) { lines.push([id, "NOT APPLIED (code found " + n + " times)", what].join("\t")); console.log(lines[lines.length - 1]); continue; }
    fs.writeFileSync(FILE, s.split(from).join(to));
    execFileSync(PY, [path.join(ROOT, "tools", "csp.py")], { stdio: "pipe" });
    const failed = [];
    for (const t of tests) { const r = spawnSync(process.execPath, [path.join(ROOT, "tests", "run.js"), t], { encoding: "utf8", cwd: path.join(ROOT, "tests") }); if (r.status !== 0) failed.push(t); }
    lines.push([id, failed.length ? "CAUGHT by " + failed.join(",") : "SURVIVED (" + tests.join(",") + " passed)", what].join("\t"));
    console.log(lines[lines.length - 1]);
    fs.writeFileSync(FILE, orig);
  }
} finally { fs.writeFileSync(FILE, orig); }
const caught = lines.filter((l) => l.includes("CAUGHT")).length;
const out = "# audit 5 mutations — " + new Date().toISOString() + "\n" + lines.join("\n") + "\ncaught " + caught + " of " + M.length + "\n";
if (process.argv[2]) fs.writeFileSync(process.argv[2], out);
console.log("caught " + caught + " of " + M.length);
process.exit(caught === M.length ? 0 : 1);

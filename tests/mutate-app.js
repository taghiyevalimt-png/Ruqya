// T-52: are the app's tests able to catch real mistakes? Each mutation puts one realistic defect into a copy of
// index.html (with the CSP hashes recomputed, so the page still runs — a broken CSP would be "caught" for nothing),
// runs the tests that should notice it, and puts the original file back. A mutation is CAUGHT when at least one of
// its tests fails. node tests/mutate-app.js [out.txt]
const fs = require("fs"), path = require("path"), { execFileSync, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, ".."), FILE = path.join(ROOT, "index.html");
const PY = process.env.PYTHON || "python";
const M = [
  ["A-01", "output escaping removed (names, notes shown as HTML)", 'function esc(s){return String(s==null?"":s).replace(', 'function esc(s){return String(s==null?"":s);String(s).replace(', ["20-xss"]],
  ["A-02", "B-15 back: a search with letters also matches phones", 'function qDigits(q){return /^[\\d\\s+()\\-.]+$/.test(q)?phoneCore(q):""}', 'function qDigits(q){return phoneCore(q)}', ["30-patient-search"]],
  ["A-03", "B-01 back: Excel counts a booking twice", 'add=function(x){if(!had[x.id]){had[x.id]=1;ap.push(x)}};', 'add=function(x){ap.push(x)};', ["23-excel-counts"]],
  ["A-04", "sign-out after 8 days instead of 7", "var IDLE_MS=7*24*3600e3,", "var IDLE_MS=8*24*3600e3,", ["02-session"]],
  ["A-05", "«Satış edildi» ignored (stays cancelled)", 'function soldRow(x){return x.status==="cancel"&&(+x.follow||0)>=3}', "function soldRow(x){return false}", ["99-sold"]],
  ["A-06", "service no longer required", 'if(!service)return fail("f-err",L("Xidmət növünü seçmək vacibdir."));', "if(!service)service=\"\";", ["99-service-ui"]],
  ["A-07", "closing a window leaves its history entry (Back reopens nothing / closes twice)", "if(drop)afterPaint(function(){try{if(history.state&&history.state.sheet)history.back()}", "if(drop)afterPaint(function(){try{if(0)history.back()}", ["96-close-history"]],
  ["A-08", "patient list read with offsets again (keyset pages off)", "state.noPageFn?byOffset():byKey()", "true?byOffset():byKey()", ["31-patients-keyset"]],
  ["A-09", "every window pinned again (short windows hidden by the keyboard)", 'if(sheet&&sheet.type==="appt"&&t&&t.closest&&t.closest("#sheet")', 'if(sheet&&t&&t.closest&&t.closest("#sheet")', ["99-short-window-keyboard"]],
  ["A-10", "B-05 back: typing not kept when the app goes to the background", 'document.addEventListener("visibilitychange",function(){if(document.hidden)keepTyping()});', 'document.addEventListener("visibilitychange",function(){});', ["26-draft-background"]],
  ["A-11", "cancelling does not change the status", 'var cprev=ca.status;ca.status="cancel";if(wasSold)', 'var cprev=ca.status;ca.status=ca.status;if(wasSold)', ["17-cancel-contact", "13-followup"]],
  ["A-12", "Russian dictionary entry broken (phone label untranslated)", '"<div class=\\"field\\"><label for=\\"f-phone\\">Mobil nömrə *</label><input id=\\"f-phone\\" type=\\"text\\"', '"<div class=\\"field\\"><label for=\\"f-phone\\">Mobil nömrə *</label><input id=\\"f-phone\\" type=\\"tel\\"', ["98-ru-dictionary"]],
];
const orig = fs.readFileSync(FILE);
const lines = [];
try {
  for (const [id, what, from, to, tests] of M) {
    const s = orig.toString("utf8");
    if (s.split(from).length !== 2) { lines.push([id, "NOT APPLIED (code not found once)", what].join("\t")); continue; }
    fs.writeFileSync(FILE, s.replace(from, to));
    execFileSync(PY, [path.join(ROOT, "tools", "csp.py")], { stdio: "pipe" });
    const failed = [];
    for (const t of tests) { const r = spawnSync(process.execPath, [path.join(ROOT, "tests", "run.js"), t], { encoding: "utf8" }); if (r.status !== 0) failed.push(t); }
    lines.push([id, failed.length ? "CAUGHT by " + failed.join(",") : "SURVIVED (" + tests.join(",") + " passed)", what].join("\t"));
    console.log(lines[lines.length - 1]);
    fs.writeFileSync(FILE, orig);
  }
} finally { fs.writeFileSync(FILE, orig); }
const caught = lines.filter((l) => l.includes("CAUGHT")).length;
const out = "# app mutations — " + new Date().toISOString() + "\n" + lines.join("\n") + "\ncaught " + caught + " of " + M.length + "\n";
if (process.argv[2]) fs.writeFileSync(process.argv[2], out);
console.log("caught " + caught + " of " + M.length);
process.exit(caught === M.length ? 0 : 1);

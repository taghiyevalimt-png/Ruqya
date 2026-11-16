#!/usr/bin/env node
// Secret scanner (gitleaks is not available in this environment; this is the substitute, rules listed below).
// Scans every tracked file of the working tree AND every line ever added in the git history (git log -p --all).
//   node tools/secret_scan.js [report.txt]      exit 1 if anything that looks like a secret is found
// Allowed by design (reported as INFO, not as a finding): the Supabase *publishable* key (sb_publishable_…), which
// the browser must have; the RSA *public* key for DR exports. Values are never printed: only file, line, rule and
// the first 6 characters.
const { execSync } = require("child_process"), fs = require("fs");
const RULES = [
  ["private-key", /-----BEGIN (RSA |EC |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/],
  ["supabase-secret-key", /sb_secret_[A-Za-z0-9_-]{10,}/],
  ["jwt (service_role or anon legacy key)", /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ["service_role word with value", /service_role[^\n]{0,20}[:=]\s*["']?[A-Za-z0-9._-]{20,}/],
  ["postgres url with password", /postgres(ql)?:\/\/[^:\s/]+:[^@\s<]{6,}@/],
  ["github token", /\b(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}/],
  ["aws key", /\bAKIA[0-9A-Z]{16}\b/],
  ["google api key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["slack token", /\bxox[abpr]-[A-Za-z0-9-]{10,}/],
  ["generic password assignment", /\b(password|passwd|pwd|secret)\s*[:=]\s*["'][^"'\s]{8,}["']/i],
  ["keystore / signing material", /\b(ANDROID_KEYSTORE_B64|BACKUP_PASSPHRASE)\s*[:=]\s*["']?[A-Za-z0-9+/=]{16,}/],
];
const INFO = [["supabase publishable key (public by design)", /sb_publishable_[A-Za-z0-9_-]{10,}/]];
const SKIP = /(^|\/)(node_modules|tests\/out|evidence)\//;
const hits = [], info = new Set();
function scan(where, text) {
  text.split("\n").forEach((line, i) => {
    for (const [rule, re] of RULES) { const m = re.exec(line); if (m) hits.push(where + ":" + (i + 1) + "  " + rule + "  «" + m[0].slice(0, 6) + "…»"); }
    for (const [rule, re] of INFO) if (re.test(line)) info.add(rule + " in " + where.replace(/:\d+$/, ""));
  });
}
const files = execSync("git ls-files", { encoding: "utf8", maxBuffer: 1 << 28 }).trim().split("\n").filter((f) => !SKIP.test(f) && !/\.(png|jpg|woff2|apk|ico)$/.test(f));
for (const f of files) { try { scan(f, fs.readFileSync(f, "utf8")); } catch (e) {} }
const log = execSync("git log -p --all --no-color --format=COMMIT%x20%H", { encoding: "utf8", maxBuffer: 1 << 30 });
let commit = "", file = "", n = 0, added = [];
for (const line of log.split("\n")) {
  if (line.startsWith("COMMIT ")) { commit = line.slice(7, 15); continue; }
  if (line.startsWith("+++ b/")) { file = line.slice(6); continue; }
  if (line.startsWith("+") && !line.startsWith("+++") && !SKIP.test(file)) { n++; for (const [rule, re] of RULES) { const m = re.exec(line); if (m) hits.push("history " + commit + " " + file + "  " + rule + "  «" + m[0].slice(0, 6) + "…»"); } for (const [rule, re] of INFO) if (re.test(line)) info.add(rule + " in history of " + file); }
}
const commits = execSync("git rev-list --all --count", { encoding: "utf8" }).trim();
const out = ["# secret scan — " + new Date().toISOString() + " — HEAD " + execSync("git rev-parse HEAD", { encoding: "utf8" }).trim(),
  "# rules: " + RULES.map((r) => r[0]).join("; "),
  "# scanned: " + files.length + " tracked files; " + commits + " commits, " + n + " added lines in history",
  "# findings: " + hits.length, ...hits, "# info (allowed by design):", ...[...info]].join("\n") + "\n";
if (process.argv[2]) fs.writeFileSync(process.argv[2], out);
console.log(out.split("\n").slice(0, 6).join("\n"));
process.exit(hits.length ? 1 : 0);

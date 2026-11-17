#!/usr/bin/env node
// Timed disaster-recovery drill of the DR export (DISASTER_RECOVERY.md, scenario B): download the artifact of a
// dr-export.yml run, restore it into a fresh PostgreSQL 17 (embedded, tests/localpg.js) with tools/dr_restore.js and
// compare every table with the manifest taken from the live database. Prints each step with its duration.
//   node tools/dr_drill.js <run-id> <dr_private.pem> <report.txt>
// Needs: gh (signed in), the private key (kept by the owner, never in the repository).
const fs = require("fs"), path = require("path"), os = require("os"), { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, ".."), [run, key, report] = process.argv.slice(2);
const { start } = require(path.join(ROOT, "tests", "localpg"));
const out = [], t0 = Date.now(), step = (s) => { const line = ((Date.now() - t0) / 1000).toFixed(1).padStart(7) + " s  " + s; out.push(line); console.log(line); };
(async () => {
  step("start (decision to restore), run " + run + ", " + new Date().toISOString());
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ruqya-drill-"));
  execFileSync("gh", ["run", "download", run, "-R", "taghiyevalimt-png/Ruqya", "-D", dir], { stdio: "pipe" });
  const art = fs.readdirSync(dir).map((d) => path.join(dir, d)).find((d) => fs.statSync(d).isDirectory()) || dir;
  step("artifact downloaded: " + fs.readdirSync(art).join(", "));
  const pg = await start(54370);
  step("empty PostgreSQL 17 started");
  let rc = 0, txt = "";
  try {
    txt = execFileSync(process.execPath, [path.join(ROOT, "tools", "dr_restore.js"), "--dir", art, "--key", key, "--port", "54370", "--db", "drill"], { encoding: "utf8" });
  } catch (e) { rc = e.status || 1; txt = String(e.stdout || "") + String(e.stderr || ""); }
  txt.split("\n").filter(Boolean).forEach((l) => out.push("           | " + l));
  step("restore and comparison finished, exit " + rc);
  await pg.stop();
  fs.rmSync(dir, { recursive: true, force: true });
  step("temporary files removed (decrypted data was only in memory and in the throw-away database)");
  fs.writeFileSync(report, "# DR drill — " + new Date().toISOString() + "\n$ node tools/dr_drill.js " + run + " <dr_private.pem> " + report + "\n" + out.join("\n") + "\n");
  process.exit(rc);
})();

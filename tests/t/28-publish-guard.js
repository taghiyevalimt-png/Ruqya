// B-07: publish.sh run from another branch must stop without pushing (before: it pushed the unchanged local main
// and still printed «version …», so nothing was published while it looked successful).
// Runs in throw-away clones with a local bare repository as "origin"; the real GitHub repository is never touched.
const { execSync } = require("child_process"), fs = require("fs"), os = require("os"), path = require("path");
const { check } = require("../lib");
const sh = (cmd, cwd) => execSync(cmd, { cwd, stdio: "pipe", encoding: "utf8", env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
module.exports = async () => {
  const root = path.resolve(__dirname, "..", ".."), t = fs.mkdtempSync(path.join(os.tmpdir(), "pubguard-")), script = process.env.PUBLISH_SH || path.join(root, "publish.sh");
  try {
    sh(`git init -q --bare -b main origin.git`, t);
    sh(`git init -q -b main work && cd work && git config user.name T && git config user.email t@t && git config core.autocrlf false`, t);
    const w = path.join(t, "work");
    for (const f of ["index.html", "version.txt"]) fs.copyFileSync(path.join(root, f), path.join(w, f));
    fs.mkdirSync(path.join(w, "tools")); fs.copyFileSync(path.join(root, "tools", "csp.py"), path.join(w, "tools", "csp.py"));
    fs.copyFileSync(script, path.join(w, "publish.sh"));
    sh(`git add -A && git commit -qm base && git remote add origin ../origin.git && git push -q origin main`, w);
    const before = sh(`git rev-parse main`, path.join(t, "origin.git")).trim();
    sh(`git checkout -q -b feature`, w);
    let code = 0, out = ""; try { out = sh(`sh publish.sh test`, w); } catch (e) { code = e.status; out = String(e.stdout) + String(e.stderr); }
    const after = sh(`git rev-parse main`, path.join(t, "origin.git")).trim();
    check(code !== 0, "publish.sh on a feature branch must fail, it exited 0 with: " + out.trim().split("\n").pop());
    check(after === before, "origin/main unchanged");
  } finally { fs.rmSync(t, { recursive: true, force: true }); }
};

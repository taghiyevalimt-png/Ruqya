// A throw-away PostgreSQL 17 for tests (npm package embedded-postgres: real server binaries, no Docker, no network).
// start() initialises a fresh data directory in tests/out/pg-<port>, starts the server and returns a "pg" pool
// factory; stop() shuts it down and removes the directory. The live database is never touched.
const fs = require("fs"), path = require("path"), os = require("os"), { spawn, execFileSync } = require("child_process");
const { Client } = require("pg");

function binDir() {
  const plat = { win32: "windows", linux: "linux", darwin: "darwin" }[process.platform], arch = process.arch === "arm64" ? "arm64" : "x64";
  const d = path.join(__dirname, "node_modules", "@embedded-postgres", plat + "-" + arch, "native", "bin");
  if (!fs.existsSync(d)) throw new Error("embedded PostgreSQL binaries not found: " + d + " (run npm ci in tests/)");
  return d;
}
// Windows: initdb finds its sibling programs through its own path, which breaks in very long folders, so the
// binaries are copied once to a short folder in the temp directory.
let BIN = null;
function bin() {
  if (BIN) return BIN;
  const src = path.join(binDir(), ".."), dst = path.join(os.tmpdir(), "ruqya-pgbin-" + require("./node_modules/@embedded-postgres/" + path.basename(path.join(src, "..")) + "/package.json").version);
  if (!fs.existsSync(path.join(dst, "bin"))) fs.cpSync(src, dst, { recursive: true });
  return (BIN = path.join(dst, "bin"));
}
const exe = (n) => path.join(bin(), process.platform === "win32" ? n + ".exe" : n);

async function waitReady(port, ms) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const c = new Client({ host: "127.0.0.1", port, user: "postgres", database: "postgres" });
    try { await c.connect(); await c.end(); return; } catch (e) { await new Promise((r) => setTimeout(r, 300)); }
  }
  throw new Error("PostgreSQL did not start on port " + port);
}

async function start(port = 54330) {
  const dir = path.join(os.tmpdir(), "ruqya-pg-" + port);   // short path: initdb fails on very long Windows paths
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(path.dirname(dir), { recursive: true });
  const pw = path.join(os.tmpdir(), "pgpw-" + port); fs.writeFileSync(pw, "test\n");
  execFileSync(exe("initdb"), ["-D", dir, "-U", "postgres", "-A", "trust", "-E", "UTF8", "--locale=C", "--pwfile", pw], { stdio: "ignore" });
  const child = spawn(exe("postgres"), ["-D", dir, "-p", String(port), "-c", "listen_addresses=127.0.0.1", "-c", "fsync=off", "-c", "max_connections=200"], { stdio: "ignore", detached: false });
  await waitReady(port, 30000);
  const conn = (db) => { const c = new Client({ host: "127.0.0.1", port, user: "postgres", database: db || "postgres" }); c.on("error", () => {}); return c.connect().then(() => c); };   // a client still open when the server stops must not crash the run
  return {
    port, conn,
    stop: async () => { try { child.kill(); } catch (e) {} await new Promise((r) => setTimeout(r, 800)); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} },
  };
}
module.exports = { start };

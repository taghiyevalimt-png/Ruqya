#!/usr/bin/env node
/*
 Restore a DR export (.github/workflows/dr-export.yml) into an empty PostgreSQL 17 and prove it is complete.

   node tools/dr_restore.js --dir <unzipped artifact> --key <dr_private.pem> [--host 127.0.0.1] [--port 5432]
                            [--user postgres] [--db ruqya_restore] [--report out.txt]

 Steps: 1) checks SHA256SUMS of the artifact; 2) decrypts the AES key with the RSA private key and the data dump with
 it — in memory only, nothing readable is written to disk; 3) checks the plaintext SHA-256 the runner recorded;
 4) creates the database (must not exist), the Supabase roles and the extension schema, loads schema.sql
 (schemas public and auth) and the data with triggers off (session_replication_role = replica, so the audit and
 rate-limit triggers do not fire on restore); 5) computes rows and content hash per table with tools/dr_manifest.sql
 and compares them with the manifest taken from the live database. Exit code 0 only if every table matches.
 Needs: Node 18+, npm package "pg" (resolved from tests/node_modules or NODE_PATH), a PostgreSQL 17 server where
 the user may create databases and roles.
*/
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const args = {}; for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
let pg; try { pg = require("pg"); } catch (e) { pg = require(path.join(__dirname, "..", "tests", "node_modules", "pg")); }
const dir = args.dir, out = [];
const log = (s) => { out.push(s); console.log(s); };
const t0 = Date.now();

function sha256(buf) { return crypto.createHash("sha256").update(buf).digest("hex"); }
function opensslDecrypt(enc, pass) {
  if (enc.subarray(0, 8).toString("latin1") !== "Salted__") throw new Error("not an openssl salted file");
  const salt = enc.subarray(8, 16), kiv = crypto.pbkdf2Sync(pass, salt, 200000, 48, "sha256");
  const d = crypto.createDecipheriv("aes-256-cbc", kiv.subarray(0, 32), kiv.subarray(32, 48));
  return Buffer.concat([d.update(enc.subarray(16)), d.final()]);
}
const ROLES = ["anon", "authenticated", "service_role", "authenticator", "supabase_admin", "supabase_auth_admin",
  "supabase_storage_admin", "supabase_realtime_admin", "supabase_replication_admin", "supabase_read_only_user", "dashboard_user", "pgbouncer", "pgsodium_keyholder", "pgsodium_keyiduser", "pgsodium_keymaker"];

(async () => {
  log("# DR restore — " + new Date().toISOString() + " — artifact " + path.resolve(dir));
  // 1. checksums
  for (const line of fs.readFileSync(path.join(dir, "SHA256SUMS"), "utf8").trim().split("\n")) {
    const [h, f] = line.trim().split(/\s+/);
    const got = sha256(fs.readFileSync(path.join(dir, f)));
    log((got === h ? "OK   " : "FAIL ") + "sha256 " + f);
    if (got !== h) throw new Error("checksum mismatch: " + f);
  }
  // 2. decrypt in memory
  const priv = fs.readFileSync(args.key);
  const pass = crypto.privateDecrypt({ key: priv, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, fs.readFileSync(path.join(dir, "key.txt.enc"))).toString("utf8").replace(/\r?\n$/, "");
  const data = opensslDecrypt(fs.readFileSync(path.join(dir, "data.sql.enc")), pass);
  const want = fs.readFileSync(path.join(dir, "data.sql.sha256"), "utf8").trim();
  log((sha256(data) === want ? "OK   " : "FAIL ") + "plaintext sha256 of the data dump (" + data.length + " bytes)");
  if (sha256(data) !== want) throw new Error("decrypted dump does not match");
  // 3. database
  const base = { host: args.host || "127.0.0.1", port: +(args.port || 5432), user: args.user || "postgres", password: process.env.PGPASSWORD };
  const db = args.db || "ruqya_restore";
  const admin = new pg.Client({ ...base, database: "postgres" }); await admin.connect();
  const ex = await admin.query("select 1 from pg_database where datname=$1", [db]);
  if (ex.rowCount) throw new Error("database " + db + " already exists: use an empty name");
  await admin.query("create database " + JSON.stringify(db));
  for (const r of ROLES) await admin.query(`do $$ begin if not exists (select 1 from pg_roles where rolname='${r}') then create role ${r} nologin; end if; end $$`);
  await admin.end();
  const c = new pg.Client({ ...base, database: db }); await c.connect();
  await c.query("drop schema public cascade;");   /* the dump creates schema public itself */
  await c.query("create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions; create extension if not exists \"uuid-ossp\" with schema extensions;");
  // pg_dump 17.6+ writes psql-only lines (\restrict / \unrestrict): drop every backslash line
  const schema = fs.readFileSync(path.join(dir, "schema.sql"), "utf8").split("\n").filter((l) => !/^\\/.test(l)).join("\n");
  await c.query(schema);
  log("OK   schema loaded (" + schema.length + " chars)");
  const sql = data.toString("utf8").split("\n").filter((l) => !/^\\/.test(l)).join("\n");
  await c.query("begin; set local session_replication_role = replica;\n" + sql + "\ncommit;");
  log("OK   data loaded");
  // 4. compare
  const live = {}; for (const l of fs.readFileSync(path.join(dir, "manifest.tsv"), "utf8").trim().split("\n")) { const [t, n, h] = l.split("|"); live[t] = { n, h }; }
  const q = fs.readFileSync(path.join(__dirname, "dr_manifest.sql"), "utf8");
  await c.query("set timezone = 'UTC'");   /* timestamps print the same as on the live side (PGTZ=UTC) */
  const r = await c.query(q);
  let bad = 0;
  for (const row of r.rows) {
    const L = live[row.tbl], ok = L && L.n === row.rows && L.h === row.hash;
    if (!ok) bad++;
    log((ok ? "OK   " : "FAIL ") + row.tbl + " rows " + row.rows + " (live " + (L ? L.n : "-") + ") hash " + (L && L.h === row.hash ? "same" : "DIFFERENT"));
  }
  const missing = Object.keys(live).filter((t) => !r.rows.some((x) => x.tbl === t));
  missing.forEach((t) => { bad++; log("FAIL missing table " + t); });
  await c.end();
  log("tables compared: " + r.rows.length + ", mismatches: " + bad + ", seconds: " + ((Date.now() - t0) / 1000).toFixed(1));
  if (args.report) fs.writeFileSync(args.report, out.join("\n") + "\n");
  process.exit(bad ? 1 : 0);
})().catch((e) => { log("ERROR " + e.message); if (args.report) fs.writeFileSync(args.report, out.join("\n") + "\n"); process.exit(2); });

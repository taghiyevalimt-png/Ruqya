// Test harness: serves the repository root on localhost and fakes Supabase (REST + Auth) inside the browser.
// No test ever talks to the real database.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const SB = "https://ldkhdeehrrajvgrtieal.supabase.co";
const OWNER = "bad097d4-5edc-402b-ad59-f633252c35d9";
const AGENT = "11111111-1111-4111-8111-111111111111";
const SPEC = "22222222-2222-4222-8222-222222222222";
const R1 = "aaaaaaaa-0000-4000-8000-000000000001";
const R2 = "aaaaaaaa-0000-4000-8000-000000000002";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2", ".txt": "text/plain" };

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split("?")[0]);
      if (p === "/" || p.endsWith("/")) p += "index.html";
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream", "cache-control": "no-store", date: new Date().toUTCString() });
      fs.createReadStream(f).pipe(r);
    });
    srv.listen(0, "127.0.0.1", () => res(srv));
  });
}

function bakuToday(off = 0) {
  const d = new Date(Date.now() + 4 * 3600e3 + off * 864e5);
  return d.toISOString().slice(0, 10);
}

function uuid() { return "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => ((Math.random() * 16) | 0).toString(16)); }

// ---------- in-memory database ----------
function seed() {
  const t = bakuToday(), now = new Date().toISOString();
  return {
    readers: [
      { id: R1, name: "Əli", archived: false, created_at: "2026-11-01T00:00:00Z", color: "#c9a24a", price: 0, share: 0 },
      { id: R2, name: "İlkin", archived: false, created_at: "2026-11-02T00:00:00Z", color: "#4a7fc9", price: 0, share: 0 },
    ],
    staff: [
      { id: OWNER, name: "Admin", role: "admin", want: null, created_at: now },
      { id: AGENT, name: "Nurlana", role: "agent", want: null, created_at: now },
      { id: SPEC, name: "Əli", role: "specialist", want: null, created_at: now },
    ],
    appts: [
      { id: uuid(), reader_id: R1, date: t, time: "10:00", duration: 90, name: "Test Pasiyent", phone: "050 111 22 33", price: 130, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: AGENT, created_at: now, updated_at: now },
    ],
    breaks: [], expenses: [], product_sales: [], stat_edits: [], services: [], audit_log: [{ id: 1 }],
  };
}

function parseFilters(url) {
  const out = [];
  for (const [k, v] of url.searchParams) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
    const m = /^(not\.)?(eq|neq|gt|gte|lt|lte|in|is)\.(.*)$/s.exec(v);
    if (m) out.push({ col: k, neg: !!m[1], op: m[2], val: m[3] });
  }
  return out;
}
function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function test(row, f) {
  const x = row[f.col] == null ? null : String(row[f.col]);
  let r;
  switch (f.op) {
    case "eq": r = x === f.val; break;
    case "neq": r = x !== f.val; break;
    case "gt": r = x != null && cmp(x, f.val) > 0; break;
    case "gte": r = x != null && cmp(x, f.val) >= 0; break;
    case "lt": r = x != null && cmp(x, f.val) < 0; break;
    case "lte": r = x != null && cmp(x, f.val) <= 0; break;
    case "in": r = f.val.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/^"|"$/g, "")).includes(x); break;
    case "is": r = f.val === "null" ? x == null : String(row[f.col]) === f.val; break;
  }
  return f.neg ? !r : r;
}
function pick(row, sel) {
  if (!sel || sel === "*") return { ...row };
  const o = {};
  for (const c of sel.split(",")) { const k = c.trim(); if (!(k in row)) return null; o[k] = row[k]; }
  return o;
}

// Attach the fake backend to a browser context. `ctl` lets a test break the network or the session.
async function attach(context, db, ctl) {
  ctl.log = [];
  const send = (route, status, body, headers = {}) =>
    route.fulfill({ status, headers: { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*", ...headers }, body: body === undefined ? "" : JSON.stringify(body) });
  await context.route("https://fonts.googleapis.com/**", (r) => r.abort());
  await context.route("https://fonts.gstatic.com/**", (r) => r.abort());
  try { await context.routeWebSocket(/supabase\.co/, (ws) => ws.close()); } catch (e) {}
  await context.route(SB + "/**", async (route) => {
    const req = route.request(), url = new URL(req.url()), m = req.method();
    if (m === "OPTIONS") return send(route, 204);
    const p = url.pathname;
    ctl.log.push(m + " " + p + url.search);
    if (ctl.offline) return route.abort("internetdisconnected");
    const uid = ctl.uid;
    if (p === "/auth/v1/settings") return send(route, 200, { disable_signup: true, external: { anonymous_users: false } });
    if (p === "/auth/v1/token") {
      if (ctl.authDown) return send(route, 400, { error: "invalid_grant", error_description: "Invalid Refresh Token" });
      const body = JSON.parse(req.postData() || "{}");
      const id = body.email ? (body.email.startsWith("agent") ? AGENT : body.email.startsWith("spec") ? SPEC : OWNER) : uid;
      ctl.uid = id; ctl.expired = false;
      return send(route, 200, session(id));
    }
    if (p === "/auth/v1/user") return ctl.expired ? send(route, 401, { code: 401, msg: "JWT expired" }) : send(route, 200, user(uid));
    if (p === "/auth/v1/logout") return send(route, 204);
    if (p.startsWith("/rest/v1/rpc/")) {
      const fn = p.slice(13), a = JSON.parse(req.postData() || "{}");
      if (ctl.noRpc && /^ruqya_hist/.test(fn)) return send(route, 404, { code: "PGRST202", message: "Could not find the function" });
      ctl.rpc = (ctl.rpc || []).concat(fn);
      const old = () => db.appts.filter((r) => r.date >= a.since && r.date < a.before);
      if (fn === "ruqya_hist_patients") {
        const g = {};
        old().sort((x, y) => (x.date < y.date ? 1 : -1)).forEach((r) => {
          const k = pkey(r), o = g[k] || (g[k] = { k, name: r.name, phone: r.phone, n: 0, noshow: 0, cancel: 0, last: r.date, first: null });
          if (r.status === "cancel") o.cancel++; else if (r.status === "noshow") o.noshow++; else { o.n++; if (!o.first || r.date < o.first) o.first = r.date; }
        });
        return send(route, 200, Object.values(g));
      }
      if (fn === "ruqya_hist_visits") return send(route, 200, old().filter((r) => pkey(r) === a.key).map(({ id, reader_id, date, name, phone, status, created_by }) => ({ id, reader_id, date, name, phone, status, created_by })));
      if (fn === "ruqya_anonymize") {
        if (uid !== OWNER) return send(route, 403, { code: "42501", message: "Yalniz admin anonimlesdirir" });
        const hit = db.appts.filter((r) => pkey(r) === a.key);
        hit.forEach((r) => Object.assign(r, { name: "Anonim", phone: "", note: "" }));
        return send(route, 200, hit.length);
      }
      return send(route, 200, null);
    }
    const t = p.replace("/rest/v1/", "");
    if (!db[t]) return send(route, 404, { code: "42P01", message: "relation does not exist" });
    if (ctl.expired) return send(route, 401, { code: "PGRST301", message: "JWT expired" });
    if (ctl.failWrite && m !== "GET" && m !== "HEAD") { const f = ctl.failWrite; ctl.failWrite = null; return f === "net" ? route.abort("connectionreset") : send(route, f.status, f.body); }
    const fl = parseFilters(url);
    if (m === "GET" || m === "HEAD") {
      let rows = db[t].filter((r) => fl.every((f) => test(r, f)));
      const sel = url.searchParams.get("select");
      rows = rows.map((r) => pick(r, sel));
      if (rows.some((r) => r === null)) return send(route, 400, { code: "42703", message: "column does not exist" });
      const off = +url.searchParams.get("offset") || 0, lim = url.searchParams.get("limit");
      rows = rows.slice(off, lim ? off + +lim : undefined);
      return send(route, 200, rows);
    }
    if (m === "POST") {
      let b = JSON.parse(req.postData() || "[]"); if (!Array.isArray(b)) b = [b];
      const now = new Date().toISOString();
      for (const r of b) db[t].push({ id: uuid(), created_at: now, updated_at: now, created_by: uid, ...r });
      return send(route, 201);
    }
    if (m === "PATCH") {
      const b = JSON.parse(req.postData() || "{}");
      db[t].filter((r) => fl.every((f) => test(r, f))).forEach((r) => Object.assign(r, b, { updated_at: new Date().toISOString() }));
      return send(route, 204);
    }
    if (m === "DELETE") { db[t] = db[t].filter((r) => !fl.every((f) => test(r, f))); return send(route, 204); }
    return send(route, 405);
  });
}
// same key as the app's pkey() and the database's ruqya_pkey()
function pkey(r) { const d = String(r.phone || "").replace(/\D/g, ""); return d.length >= 7 ? "p" + d.slice(-9) : "n" + String(r.name || "").trim().toLowerCase().replace(/̇/g, "").replace(/ı/g, "i"); }
function user(id) { return { id, aud: "authenticated", role: "authenticated", email: id.slice(0, 4) + "@ruqya.az", app_metadata: {}, user_metadata: {}, created_at: "2026-11-01T00:00:00Z" }; }
function session(id, expiresIn = 3600) {
  return { access_token: "tok-" + id, token_type: "bearer", expires_in: expiresIn, expires_at: Math.floor(Date.now() / 1000) + expiresIn, refresh_token: "ref-" + id, user: user(id) };
}

const tokenKey = "sb-ldkhdeehrrajvgrtieal-auth-token";

// Open the app signed in as `who` (OWNER / AGENT / SPEC). Returns { browser, page, db, ctl, close }.
async function open(who = OWNER, opt = {}) {
  const srv = await serve();
  const browser = await chromium.launch({ channel: "chrome", headless: !process.env.HEADED });
  const context = await browser.newContext({ viewport: opt.viewport || { width: 390, height: 844 }, locale: "az-AZ", timezoneId: "Asia/Baku", hasTouch: !!opt.touch, isMobile: !!opt.touch, bypassCSP: !!opt.bypassCSP, colorScheme: opt.colorScheme || "light" });
  const db = opt.db || seed();
  const ctl = { uid: who };
  await attach(context, db, ctl);
  const errors = [];
  if (who) {
    const s = session(who);
    await context.addInitScript(([k, v, lang]) => { try { if (location.protocol !== "http:") return; } catch (e) { return; } if (!sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); if (lang) localStorage.setItem("ruqya.lang", lang); sessionStorage.setItem("seeded", "1"); } }, [tokenKey, JSON.stringify(s), opt.lang || ""]);
  }
  if (opt.init) await context.addInitScript(opt.init[0], opt.init[1]);
  if (opt.clock) {
    // the app corrects its clock by the server's Date header: answer without one so the fake time stands
    await context.route("**/version.txt*", (r) => r.fulfill({ status: 404, body: "" }));
  }
  const page = await context.newPage();
  if (opt.clock) await page.clock.install({ time: opt.clock });
  page.on("pageerror", (e) => errors.push(String(e)));
  const base = "http://127.0.0.1:" + srv.address().port + "/";
  await page.goto(base + (opt.hash || ""));
  if (who) await page.waitForFunction(() => window.__ruqya ? true : document.querySelector("#main") && document.querySelector("#main").children.length > 0, null, { timeout: 15000 });
  return { browser, context, page, db, ctl, errors, base, close: async () => { await browser.close(); srv.close(); } };
}

function check(cond, msg) { if (!cond) throw new Error("FAIL: " + msg); }

module.exports = { open, seed, check, bakuToday, uuid, OWNER, AGENT, SPEC, R1, R2, tokenKey, session };

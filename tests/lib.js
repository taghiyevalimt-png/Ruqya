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

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".json": "application/json", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2", ".txt": "text/plain" };

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
      { id: OWNER, name: "Admin", role: "admin", want: null, created_at: now, hide_stats: false },
      { id: AGENT, name: "Nurlana", role: "agent", want: null, created_at: now, hide_stats: false },
      { id: SPEC, name: "Əli", role: "specialist", want: null, created_at: now, hide_stats: false },
    ],
    appts: [
      { id: uuid(), reader_id: R1, date: t, time: "10:00", duration: 90, name: "Test Pasiyent", phone: "050 111 22 33", price: 130, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: AGENT, created_at: now, updated_at: now },
    ],
    breaks: [], expenses: [], product_sales: [], products: [], product_shares: [], service_shares: [], stat_edits: [], services: [], audit_log: [{ id: 1 }], app_errors: [],
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
      // the sign-in server itself failing (seen live 22.11: «error finding refresh token: timeout», «unexpected EOF»)
      if (ctl.auth500 && !JSON.parse(req.postData() || "{}").email) { ctl.auth500--; return send(route, ctl.auth5xx || 500, { code: 500, error_code: "unexpected_failure", msg: "500: error finding refresh token: timeout: context canceled" }); }
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
      // P-05: the page function (keyset: after_k, lim ≤ 1000); ctl.noPage = a database without it (older install)
      if (fn === "ruqya_hist_patients_page" && ctl.noPage) return send(route, 404, { code: "PGRST202", message: "Could not find the function public.ruqya_hist_patients_page" });
      if (fn === "ruqya_hist_patients" || fn === "ruqya_hist_patients_page") {
        const g = {};
        old().sort((x, y) => (x.date < y.date ? 1 : -1)).forEach((r) => {
          const k = pkey(r), o = g[k] || (g[k] = { k, name: r.name, phone: r.phone, n: 0, noshow: 0, cancel: 0, last: r.date, first: null });
          const st = r.status === "cancel" && (+r.follow || 0) >= 3 ? "wait" : r.status;   // «Satış edildi» counts as successful (as on the server)
          if (st === "cancel") o.cancel++; else if (st === "noshow") o.noshow++; else { o.n++; if (!o.first || r.date < o.first) o.first = r.date; }
        });
        // like PostgREST: at most 1000 rows per answer (db max-rows), paging with offset/limit
        const all = Object.values(g).sort((x, y) => (x.k < y.k ? -1 : 1));
        if (fn === "ruqya_hist_patients_page") { const after = a.after_k || ""; return send(route, 200, all.filter((x) => x.k > after).slice(0, Math.max(1, Math.min(+a.lim || 1000, 1000)))); }
        const off = +url.searchParams.get("offset") || 0, lim = Math.min(+url.searchParams.get("limit") || 1000, 1000);
        return send(route, 200, all.slice(off, off + lim));
      }
      // owner 18.11: the caller's own patients (name, phone), two years, latest name per patient
      if (fn === "ruqya_my_contacts") { const g = {}; db.appts.filter((r) => r.created_by === uid && r.date >= a.since && String(r.phone || "").trim()).sort((x, y) => (x.date < y.date ? 1 : -1)).forEach((r) => { const k = String(r.phone).replace(/\D/g, "").slice(-9); /* one contact per number (audit 5: not per patient key) */ if (!g[k]) g[k] = { name: r.name, phone: r.phone }; }); return send(route, 200, Object.values(g)); }
      // 24.11 wave 2 (sql/2026-11-wave2.sql): VIP (≥ min_vip visits not cancelled up to today) and «mine»; merging duplicates
      if (fn === "ruqya_patient_marks" && (ctl.noMarks || db.__noMarks)) return send(route, 404, { code: "PGRST202", message: "Could not find the function" });
      if (fn === "ruqya_patient_marks") { const g = {}, t = bakuToday();
        db.appts.filter((r) => r.date >= bakuToday(-800)).forEach((r) => { const k = pkey(r), o = g[k] || (g[k] = { k, n: 0, mine: false }); if (!["cancel", "noshow"].includes(r.status) && r.date <= t) o.n++; if (r.created_by === uid) o.mine = true; });
        return send(route, 200, Object.values(g).filter((x) => x.n >= (a.min_vip || 5) || x.mine).map((x) => ({ k: x.k, vip: x.n >= (a.min_vip || 5), mine: x.mine }))); }
      if (fn === "ruqya_merge_patients") { if (uid !== OWNER) return send(route, 403, { code: "42501", message: "Yalniz admin birlesdirir" });
        const nm = String(a.p_name || "").trim().replace(/\s+/g, " "); let n = 0; const now = new Date().toISOString();
        db.appts.forEach((r) => { if (a.keys.includes(pkey(r)) && r.name !== nm) { r.name = nm; r.updated_at = now; n++; } }); ctl.merged = (ctl.merged || 0) + 1; return send(route, 200, n); }
      if (fn === "ruqya_hist_visits") return send(route, 200, old().filter((r) => pkey(r) === a.key).map(({ id, reader_id, date, name, phone, status, created_by }) => ({ id, reader_id, date, name, phone, status, created_by })));
      if (fn === "ruqya_anonymize") {
        if (uid !== OWNER) return send(route, 403, { code: "42501", message: "Yalniz admin anonimlesdirir" });
        const hit = db.appts.filter((r) => pkey(r) === a.key);
        hit.forEach((r) => Object.assign(r, { name: "Anonim", phone: "", note: "" }));
        return send(route, 200, hit.length);
      }
      // 24.11 notifications (sql/2026-11-notify.sql): settings per user, browser subscriptions, Android device tokens
      if (/^ruqya_(notify|push)_/.test(fn) && ctl.noNotify) return send(route, 404, { code: "PGRST202", message: "Could not find the function public." + fn });
      if (/^ruqya_(notify|push)_/.test(fn)) {
        const N = (db.notify = db.notify || { prefs: {}, subs: [], devices: [] }), me = N.prefs[uid] || { remind_min: null, on_new: false };
        const staffMe = (db.staff || []).find((x) => x.id === uid), nm = staffMe && staffMe.role !== "agent" ? String(staffMe.name || "").trim().toLowerCase() : "";
        if (fn === "ruqya_notify_get") return send(route, 200, { remind_min: me.remind_min, on_new: me.on_new, linked: !!nm && db.readers.some((r) => String(r.name).trim().toLowerCase() === nm), vapid: "BPmockVapidKey_" + "A".repeat(72), subs: N.subs.filter((x) => x.user === uid).length, report: !!me.report, admin: uid === OWNER || !!(staffMe && staffMe.role === "admin") });
        if (fn === "ruqya_notify_set") { N.prefs[uid] = { remind_min: a.p_remind, on_new: !!a.p_new, lang: a.p_lang, report: !!me.report }; return send(route, 200, null); }
        if (fn === "ruqya_notify_report") { if (!(uid === OWNER || (staffMe && staffMe.role === "admin"))) return send(route, 403, { code: "42501", message: "Yalniz admin" }); N.prefs[uid] = Object.assign({}, me, { report: !!a.p_on, lang: a.p_lang }); return send(route, 200, null); }
        if (fn === "ruqya_push_sub") { N.subs = N.subs.filter((x) => x.endpoint !== a.p_endpoint).concat({ user: uid, endpoint: a.p_endpoint, p256dh: a.p_p256dh, auth: a.p_auth }); return send(route, 200, null); }
        if (fn === "ruqya_push_unsub") { N.subs = N.subs.filter((x) => x.endpoint !== a.p_endpoint); return send(route, 200, null); }
        if (fn === "ruqya_notify_device") { const t = "d0000000-0000-4000-8000-" + String(N.devices.length + 1).padStart(12, "0"); N.devices.push({ token: t, user: uid }); return send(route, 200, t); }
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
      // column defaults of the real table (live schema 17.11), so a row saved with only the form's fields reads back
      // like on the server (T-03)
      const def = t === "appts" ? { phone: "", note: "", status: "wait", settled: false, service: "Ruqya", duration: 90, confirmed: false, place: "ofis", follow: 0 }
        : t === "breaks" ? { reader_id: null, days: null, date_from: null, date_to: null } : t === "app_errors" ? { at: now, uid } : {};
      // upsert (on_conflict=a,b): a row with the same key is replaced, like PostgREST with merge-duplicates
      // ignoreDuplicates (Prefer: resolution=ignore-duplicates) keeps the stored row and skips the new one
      const oc = url.searchParams.get("on_conflict"), ign = /ignore-duplicates/.test(req.headers()["prefer"] || "");
      if (oc) { const ks = oc.split(","), same = (x, r) => ks.every((k) => String(x[k]) === String(r[k])); if (ign) b = b.filter((r) => !db[t].some((x) => same(x, r))); else db[t] = db[t].filter((x) => !b.some((r) => same(x, r))); }
      const noId = t === "product_shares" || t === "service_shares";   // composite primary key, no id column (as live)
      for (const r of b) db[t].push(noId ? { ...r } : { id: uuid(), created_at: now, updated_at: now, created_by: uid, ...def, ...r });
      return send(route, 201);
    }
    function rep() { return /return=representation/.test(req.headers()["prefer"] || ""); }
    // like PostgREST: a column asked for with .select() that the table does not have is a 400 (42703)
    if ((m === "PATCH" || m === "DELETE") && rep() && url.searchParams.get("select") && db[t].length && pick(db[t][0], url.searchParams.get("select")) === null) return send(route, 400, { code: "42703", message: "column does not exist" });
    if (m === "PATCH") {
      const b = JSON.parse(req.postData() || "{}");
      const hit = db[t].filter((r) => fl.every((f) => test(r, f))); hit.forEach((r) => Object.assign(r, b, { updated_at: new Date().toISOString() }));
      return rep() ? send(route, 200, hit.map((r) => pick(r, url.searchParams.get("select")))) : send(route, 204);
    }
    // like PostgREST: .select() after update/delete (Prefer: return=representation) answers with the rows it touched —
    // none when the row is gone or row-level security hides it
    if (m === "DELETE") { const hit = db[t].filter((r) => fl.every((f) => test(r, f))); db[t] = db[t].filter((r) => hit.indexOf(r) < 0); return rep() ? send(route, 200, hit.map((r) => pick(r, url.searchParams.get("select")))) : send(route, 204); }
    return send(route, 405);
  });
}
// same key as the app's pkey() and the database's ruqya_pkey()
// A5-K3: phone + name, names folded like ruqya_pnorm() (sql/2026-11-a5-patient-key.sql)
const FOLD = { "ə": "e", "ç": "c", "ş": "s", "ğ": "g", "ö": "o", "ü": "u", "ı": "i", "ё": "е" };
function pnorm(x) { return String(x || "").normalize("NFC").replace(/[\u200b\u200c\u200d\u2060\ufeff]/g, "").toLowerCase().replace(/\u0307/g, "").replace(/[əçşğöüıё]/g, (c) => FOLD[c]).replace(/[\t\n\r \u00a0]+/g, " ").trim(); }
function pkey(r) { const d = String(r.phone || "").replace(/\D/g, ""); return d.length >= 7 ? "p" + d.slice(-9) + "|" + pnorm(r.name) : "n" + pnorm(r.name); }
function user(id) { return { id, aud: "authenticated", role: "authenticated", email: id.slice(0, 4) + "@ruqya.az", app_metadata: {}, user_metadata: {}, created_at: "2026-11-01T00:00:00Z" }; }
function session(id, expiresIn = 3600) {
  return { access_token: "tok-" + id, token_type: "bearer", expires_in: expiresIn, expires_at: Math.floor(Date.now() / 1000) + expiresIn, refresh_token: "ref-" + id, user: user(id) };
}

const tokenKey = "sb-ldkhdeehrrajvgrtieal-auth-token";

// Open the app signed in as `who` (OWNER / AGENT / SPEC). Returns { browser, page, db, ctl, close }.
async function open(who = OWNER, opt = {}) {
  const srv = await serve();
  const browser = await chromium.launch({ channel: "chrome", headless: !process.env.HEADED });
  const context = await browser.newContext({ viewport: opt.viewport || { width: 390, height: 844 }, locale: "az-AZ", timezoneId: opt.timezoneId || "Asia/Baku", hasTouch: !!opt.touch, isMobile: !!opt.touch, bypassCSP: !!opt.bypassCSP, colorScheme: opt.colorScheme || "light" });
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

// The calendar's day without the removed week strip (owner 24.11): ‹ › until the header shows day d (YYYY-MM-DD).
async function goDay(p, d) {
  for (let i = 0; i < 120; i++) {
    const cur = await p.evaluate(() => { const l = document.querySelector("#top .daynav.withsw .label"); return l ? l.getAttribute("data-d") : null; });
    if (!cur) { await p.click('#tabs [data-tab="day"]'); await p.waitForTimeout(250); continue; }
    if (cur === d) return;
    await p.click('#top [data-act="shift"][data-n="' + (d > cur ? 1 : -1) + '"]'); await p.waitForTimeout(80);
  }
  throw new Error("goDay: could not reach " + d);
}
// Monday … Sunday of the week of day d (as the old strip showed them)
function weekOf(d) { const t = new Date(d + "T12:00:00Z"), m = new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * 864e5); return [...Array(7)].map((_, i) => new Date(m.getTime() + i * 864e5).toISOString().slice(0, 10)); }
module.exports = { goDay, weekOf, open, seed, check, bakuToday, uuid, OWNER, AGENT, SPEC, R1, R2, tokenKey, session };

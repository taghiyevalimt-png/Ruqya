// A5-K4 acceptance: every number of «Ümumi cədvəl» (Yazdı, Uğurlu, Ləğv per person; sessions per service and place; the
// totals) and of «Kim neçə seans yazıb» on the screen equals an independent SQL count — 20 combinations of period, offset,
// role and «today» (year change, 29 February, Friday/Thursday borders, Baku midnight). The SQL is written from the rules
// (owner 23.11: «Yazdı» and «Kim neçə seans yazıb» = every booking written in the period, cancelled ones too)
// in HANDOFF.md §7 (not from the app's code); the periods are computed here from the same rules.
// Needs psql and the local PostgreSQL of audit 5 (127.0.0.1:54330, database eqv). Run: cd tests && node a5/stats-ref.js
const { execFileSync } = require("child_process");
const { open, seed, OWNER, AGENT, SPEC, R1, R2, uuid } = require("../lib");
// 23.11: any running PostgreSQL — RUQYA_PG_PORT (as the other database tests); the database «eqv» is made if missing
const PORT = process.env.RUQYA_PG_PORT || "54330";
try { execFileSync("psql", ["-h", "127.0.0.1", "-p", PORT, "-U", "postgres", "-tAq", "-c", "create database eqv"], { stdio: "ignore" }); } catch (e) {}
const PSQL = (sql) => execFileSync("psql", ["-h", "127.0.0.1", "-p", PORT, "-U", "postgres", "-d", "eqv", "-tAq", "-v", "ON_ERROR_STOP=1", "-f", "-"], { input: sql, encoding: "utf8", maxBuffer: 1e8 });
const A2 = "33333333-3333-4333-8333-333333333333", A3 = "44444444-4444-4444-8444-444444444444";
const day = (d, n) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const dow = (d) => new Date(d + "T12:00:00Z").getUTCDay();   // 0 Sunday … 5 Friday
// periods from the rules: a week is Friday–Thursday; «Keçən həftə» = the last finished one (and earlier ones with ‹)
const friOnOrBefore = (d) => day(d, -((dow(d) - 5 + 7) % 7));
const firstFri = (y, m) => { const d = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10); return day(d, (5 - dow(d) + 7) % 7); };
const mBlock = (y, m) => { if (m < 0) { y--; m += 12; } if (m > 11) { y++; m -= 12; } const s = firstFri(y, m), n = m === 11 ? firstFri(y + 1, 0) : firstFri(y, m + 1); return { y, m, s, e: day(n, -1) }; };
function period(kind, today, off) {
  if (kind === "today") return { s: today, e: today };
  if (kind === "cweek") { const s = friOnOrBefore(today); return { s, e: day(s, 6) }; }
  if (kind === "week") { const lastEnd = day(friOnOrBefore(today), -1); const e = day(lastEnd, -7 * off); return { s: day(e, -6), e }; }
  const t = new Date(today + "T12:00:00Z"); let b = mBlock(t.getUTCFullYear(), t.getUTCMonth());
  if (kind === "cmonth") { if (b.s > today) b = mBlock(b.y, b.m - 1); return { s: b.s, e: b.e }; }
  while (b.e >= today) b = mBlock(b.y, b.m - 1);
  for (let i = 0; i < off; i++) b = mBlock(b.y, b.m - 1);
  return { s: b.s, e: b.e };
}
module.exports.period = period;
(async () => {
  // data: 3 agents, a specialist who books for himself, the admin; bookings around Baku midnight, cancelled, «sold»
  // (cancelled with 3 follow-ups counts as successful), no-show, an unknown writer; 30 months around the «todays»
  const W = [AGENT, A2, A3, SPEC, OWNER, "99999999-9999-4999-8999-999999999999"], S = ["Ruqya", "Hicama", "Kombo", "Masaj", "Dr.Günel", "Psixoloq"], PL = ["ofis", "onlayn", "unvan"];
  let rnd = 99; const R = () => (rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648;
  const rows = [];
  for (let i = 0; i < 6000; i++) {
    const d = day("2026-06-01", Math.floor(R() * 1000));
    const cdays = Math.floor(R() * 20), cmin = R() < .15 ? (R() < .5 ? 19 * 60 + 59 : 20 * 60 + 1) : Math.floor(R() * 1440);   // 19:59 / 20:01 UTC = 23:59 / 00:01 Baku
    const c = new Date(Date.parse(day(d, -cdays) + "T00:00:00Z") - 4 * 3600e3 + cmin * 60e3 + 4 * 3600e3 - 4 * 3600e3).toISOString();
    const st = R(), status = st < .1 ? "cancel" : st < .13 ? "noshow" : "wait";
    rows.push({ id: uuid(), reader_id: R() < .5 ? R1 : R2, date: d, time: ["08:00", "10:30", "13:00", "22:30"][Math.floor(R() * 4)], duration: 90, name: "P" + i, phone: "050" + (1000000 + i), price: 100, share: 0, status, note: "", settled: false, service: S[Math.floor(R() * 6)], confirmed: false, place: PL[Math.floor(R() * 3)], follow: status === "cancel" && R() < .3 ? 3 : 0, created_by: W[Math.floor(R() * W.length)], created_at: c, updated_at: c });
  }
  // the same rows in PostgreSQL
  PSQL("drop table if exists t_appts; create table t_appts(id uuid, reader_id uuid, date date, time text, duration int, status text, follow int, service text, place text, created_by uuid, created_at timestamptz)");
  const esc = (v) => v == null ? "null" : "'" + String(v).replace(/'/g, "''") + "'";
  for (let i = 0; i < rows.length; i += 1000) PSQL("insert into t_appts values " + rows.slice(i, i + 1000).map((r) => "(" + [r.id, r.reader_id, r.date, r.time, r.duration, r.status, r.follow, r.service, r.place, r.created_by, r.created_at].map(esc).join(",") + ")").join(","));
  const roles = { [AGENT]: "agent", [A2]: "agent", [A3]: "agent", [SPEC]: "specialist", [OWNER]: "admin" };
  const names = { [AGENT]: "Nurlana", [A2]: "Asiya", [A3]: "Tahirə", [SPEC]: "Əli", [OWNER]: "Admin" };
  const combos = [];
  for (const [today, nowUtc] of [["2027-01-07", "2027-01-07T08:00:00Z"], ["2028-02-29", "2028-02-29T19:30:00Z"], ["2027-01-01", "2026-12-31T20:30:00Z"]])
    for (const [k, off] of [["today", 0], ["cweek", 0], ["week", 0], ["week", 1], ["cmonth", 0], ["month", 0], ["month", 1]]) combos.push({ today, nowUtc, k, off });
  const out = [], bad = [];
  let s = null, cur = null;
  for (const who of [OWNER, AGENT]) for (const c of combos) {
    if (out.length >= 42) break;
    if (!s || cur !== who + c.nowUtc) {
      if (s) await s.close();
      const db = seed(); db.appts = rows.map((r) => ({ ...r })); db.staff.push({ id: A2, name: "Asiya", role: "agent", want: null, created_at: "2026-01-01T00:00:00Z", hide_stats: false }, { id: A3, name: "Tahirə", role: "agent", want: null, created_at: "2026-01-01T00:00:00Z", hide_stats: false });
      s = await open(who, { db, clock: new Date(c.nowUtc) }); cur = who + c.nowUtc;
      await s.page.locator("#tabs:not([hidden])").waitFor({ timeout: 30000 }); await s.page.waitForTimeout(2500);
      await s.page.click('#tabs [data-tab="stats"]'); await s.page.waitForTimeout(300);
    }
    const p = s.page, P = period(c.k, c.today, c.off);
    await p.click('#top [data-act="st-sec"][data-id="' + c.k + '"]').catch(() => {});
    if (c.k === "week" || c.k === "month") { await p.evaluate((k) => { const b = document.querySelector('[data-act="st-' + k + '"][data-n="1"]'); for (let i = 0; i < 30 && b && !b.disabled; i++) b.click(); }, c.k); for (let i = 0; i < c.off; i++) { await p.click('[data-act="st-' + c.k + '"][data-n="-1"]'); await p.waitForTimeout(150); } }
    await p.waitForTimeout(500);
    for (let w = 0; w < 30 && /Köhnə məlumatlar yüklənir/.test(await p.textContent("#main")); w++) await p.waitForTimeout(500);
    const ui = await p.evaluate((k) => {
      const per = k === "today" ? "day" : k, t = document.querySelector('[data-st="big-' + per + '"] table'), ss = document.querySelector('[data-st="sess-' + per + '"] table');
      if (!t) return null;
      const h = [...t.querySelectorAll("th.v span")].map((x) => x.textContent.trim());
      const rows = {}; [...t.querySelectorAll("tbody tr")].forEach((r) => { const c = [...r.children].map((x) => x.textContent.trim()); rows[c[0]] = c.slice(1); });
      const tot = [...t.querySelector("tfoot tr").children].map((x) => x.textContent.trim()).slice(1);
      const sess = {}; if (ss) [...ss.querySelectorAll("tbody tr")].forEach((r) => { const c = [...r.children].map((x) => x.textContent.trim()); sess[c[0]] = c[2]; });
      return { h, rows, tot, sess, label: (document.querySelector("#main .daynav .label") || {}).textContent || "" };
    }, c.k);
    // reference, in SQL
    const nowB = new Date(Date.parse(c.nowUtc) + 4 * 3600e3), nd = nowB.toISOString().slice(0, 10), nm = nowB.getUTCHours() * 60 + nowB.getUTCMinutes();
    const base = `with a as (select *, case when status='cancel' and follow>=3 then 'wait' else status end st, (created_at at time zone 'Asia/Baku')::date cd,
        (date < '${nd}' or (date = '${nd}' and (split_part(time,':',1)::int*60+split_part(time,':',2)::int+duration) <= ${nm})) ended from t_appts)`;
    const only = who === OWNER ? "" : ` and created_by='${who}'`;
    const sales = JSON.parse(PSQL(`${base} select coalesce(json_object_agg(w, json_build_array(y,u,l)),'{}') from (
        select w, sum(y)::int y, sum(u)::int u, sum(l)::int l from (
          select created_by::text w, (cd between '${P.s}' and '${P.e}')::int y,   -- owner 23.11: cancelled ones count too
                 (date between '${P.s}' and '${P.e}' and st not in ('cancel','noshow') and ended)::int u,
                 (date between '${P.s}' and '${P.e}' and st in ('cancel','noshow'))::int l
          from a where created_by <> '${SPEC}'${only}) x group by w) z`));
    const svc = JSON.parse(PSQL(`${base} select coalesce(json_object_agg(k, n),'{}') from (select service||'|'||coalesce(created_by::text,'') k, count(*)::int n from a where date between '${P.s}' and '${P.e}' and st not in ('cancel','noshow')${only} group by 1) x`));
    const sess = JSON.parse(PSQL(`${base} select coalesce(json_object_agg(w, n),'{}') from (select created_by::text w, count(*)::int n from a where cd between '${P.s}' and '${P.e}'${only} group by 1) x`));   // owner 23.11: cancelled ones count too
    const label = c.k + (c.off ? "-" + c.off : "") + " today " + c.today + " as " + (who === OWNER ? "admin" : "agent");
    if (!ui) { bad.push(label + ": no table"); continue; }
    const nameOf = (id) => names[id] || "Adsız";
    const diffs = [];
    // Yazdı / Uğurlu / Ləğv per agent and admin (the specialist and the unknown writer have «·»)
    Object.keys(sales).forEach((id) => { if (!names[id] || id === SPEC) { if (id !== SPEC && (who === OWNER)) { const r = ui.rows["Adsız"]; if (r && (r[3] !== String(sales[id][0]) || r[4] !== String(sales[id][1]) || r[5] !== String(sales[id][2]))) diffs.push("Adsız " + r.slice(3, 6) + " ≠ " + sales[id]); } return; }
      const r = ui.rows[nameOf(id)]; if (!r) { if (sales[id].some((v) => v)) diffs.push(nameOf(id) + " missing"); return; }
      if (r[3] !== String(sales[id][0]) || r[4] !== String(sales[id][1]) || r[5] !== String(sales[id][2])) diffs.push(nameOf(id) + " Yazdı/Uğurlu/Ləğv " + r.slice(3, 6).join("/") + " ≠ " + sales[id].join("/")); });
    // services per writer
    Object.keys(ui.rows).forEach((nm) => { const id = Object.keys(names).find((k) => names[k] === nm) || "99999999-9999-4999-8999-999999999999"; ["Ruqya", "Hicama", "Kombo", "Masaj", "Dr.Günel", "Psixoloq"].forEach((sv) => { const i = ui.h.indexOf(sv); const want = svc[sv + "|" + id] || 0; if (+ui.rows[nm][i] !== want) diffs.push(nm + " " + sv + " " + ui.rows[nm][i] + " ≠ " + want); }); });
    // sessions per person
    Object.keys(sess).forEach((id) => { const nm = nameOf(id), v = ui.sess[nm]; if (String(sess[id]) !== v) diffs.push("sessions " + nm + " " + v + " ≠ " + sess[id]); });
    out.push((diffs.length ? "FAIL " : "ok   ") + label + "  period " + P.s + "…" + P.e + "  screen «" + ui.label.replace(/\s+/g, " ").trim().slice(0, 60) + "»" + (diffs.length ? "\n      " + diffs.slice(0, 6).join("\n      ") : ""));
    if (diffs.length) bad.push(label);
  }
  if (s) await s.close();
  console.log(out.join("\n")); console.log("combinations:", out.length, " wrong:", bad.length);
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(String(e && e.message || e).slice(0, 600)); process.exit(2); });

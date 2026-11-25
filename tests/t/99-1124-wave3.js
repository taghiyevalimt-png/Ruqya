// Owner 24.11 — wave 3 of the liked ideas:
//  (4) Statistika: ↑↓ % against the period before (last week ↔ the week before; this week ↔ the same days of last week).
//  (3) new and returning patients among the period's sessions.
//  (2) «⬇ PDF» (admins): the period's report as a real PDF (pages drawn with the app's fonts), downloadable.
//  (1) «Axşam hesabatı (22:00)» in Bildirişlər for admins (also without a column of their own); agents cannot.
const { open, check, OWNER, AGENT, seed, R1, R2, bakuToday, uuid } = require("../lib");
const fakePush = () => { const fake = { endpoint: "https://push.example/rep", toJSON() { return { endpoint: this.endpoint, keys: { p256dh: "B" + "A".repeat(86), auth: "AAAAAAAAAAAAAAAAAAAAAA" } }; }, unsubscribe() { window.__sub = null; return Promise.resolve(true); } };
  window.__sub = null; if (window.PushManager) { PushManager.prototype.subscribe = function () { window.__sub = fake; return Promise.resolve(fake); }; PushManager.prototype.getSubscription = function () { return Promise.resolve(window.__sub); }; } };
const addDays = (d, n) => { const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
module.exports = async () => {
  const t = bakuToday(), wd = new Date(t + "T12:00:00Z").getUTCDay(), fri = addDays(t, -((wd - 5 + 7) % 7));   // this week's Friday
  const last = addDays(fri, -7), prev = addDays(fri, -14);
  const db = seed(); db.appts = [];
  const row = (date, name, phone, st) => ({ id: uuid(), reader_id: R1, date, time: "10:00", duration: 60, name, phone, price: 0, share: 0, status: st || "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: AGENT, created_at: date + "T06:00:00Z", updated_at: date + "T06:00:00Z" });
  db.appts.push(row(prev, "Köhnə", "050 100 00 01"), row(addDays(prev, 1), "Başqa", "050 100 00 02"));                       // the week before: 2
  db.appts.push(row(last, "Köhnə", "050 100 00 01"), row(addDays(last, 1), "Yeni Bir", "050 100 00 03"), row(addDays(last, 2), "Yeni İki", "050 100 00 04"),
    row(addDays(last, 3), "Ləğvli", "050 100 00 05", "cancel"));                                                                  // last week: 3 + 1 cancelled
  db.products = [{ id: uuid(), name: "Ruqyalı su", price: 5, archived: false, sort: 1, created_at: last + "T06:00:00Z" }];
  db.product_sales = [{ id: uuid(), date: addDays(last, 1), amount: 10, qty: 2, price: 5, names: "Ruqyalı su", product_id: db.products[0].id, created_by: AGENT, created_at: last + "T06:00:00Z" }];
  const s = await open(OWNER, { db, viewport: { width: 390, height: 844 }, init: [fakePush, null] });
  try {
    const p = s.page; await s.context.grantPermissions(["notifications"]);
    await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
    await p.click('#tabs [data-tab="stats"]'); await p.click('[data-act="st-sec"][data-id="week"]'); await p.waitForTimeout(2500);
    const tiles = () => p.evaluate(() => [...document.querySelectorAll(".pertot > div, .newret > div")].map((d) => ({ n: d.querySelector("b").textContent, l: d.querySelector("span").textContent, d: (d.querySelector(".dlt") || {}).textContent || "", cls: (d.querySelector(".dlt") || {}).className || "" })));
    let tl = await tiles();
    const by = (l) => tl.find((x) => x.l === l) || {};
    const prevOk = prev >= "2026-11-06";
    if (prevOk) {
      check(by("Yazdı").n === "4" && by("Yazdı").d === "↑ 100%" && /good/.test(by("Yazdı").cls), "Yazdı 4 against 2: ↑ 100%: " + JSON.stringify(tl));
      check(by("Uğurlu").n === "3" && by("Uğurlu").d === "↑ 50%", "Uğurlu 3 against 2: ↑ 50%");
      check(by("Ləğv").n === "1" && by("Ləğv").d === "↑ +1" && /bad/.test(by("Ləğv").cls), "more cancelled is shown red: " + JSON.stringify(by("Ləğv")));
      check(/keçən dövrlə müqayisə/.test(await p.textContent(".cmpnote")), "says what it is compared with");
    }
    check(by("Yeni pasiyent").n === "2" && by("Qayıdan").n === (prevOk ? "1" : "0") || !prevOk, "new 2, returning 1 (Köhnə came the week before): " + JSON.stringify(tl));
    // this week: compared with the same days of last week
    await p.click('[data-act="st-sec"][data-id="cweek"]'); await p.waitForTimeout(1200);
    check(/eyni sayda gün/.test(await p.textContent(".cmpnote")), "a running week is compared with the same number of days: " + await p.textContent(".cmpnote"));
    // PDF
    await p.click('[data-act="st-sec"][data-id="week"]'); await p.waitForTimeout(600);
    await p.click('[data-act="pdf"]'); await p.locator('#sheet a.primary[download$=".pdf"]').waitFor({ timeout: 20000 });
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click('#sheet a.primary')]);
    const buf = require("fs").readFileSync(await dl.path()), all = buf.toString("latin1");
    const pdf = { head: all.slice(0, 8), size: buf.length, pages: (all.match(/\/Type \/Page\b/g) || []).length, eof: all.trimEnd().endsWith("%%EOF"), xref: /startxref\n(\d+)/.exec(all), name: dl.suggestedFilename(), xrefAt: all.indexOf("xref\n0 ") };
    require("fs").writeFileSync("/tmp/wave3.pdf", buf);
    check(pdf.head === "%PDF-1.4" && pdf.eof && pdf.pages >= 1 && pdf.size > 20000, "a real PDF: " + JSON.stringify(pdf));
    check(pdf.xref && +pdf.xref[1] === pdf.xrefAt, "the cross-reference offset is right");
    check(pdf.name === "Merkez-hesabat-" + last + ".pdf", "named by the period: " + pdf.name);
    await p.click('[data-act="close"]'); await p.waitForTimeout(300);
    // evening report
    await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="notify"]'); await p.waitForTimeout(800);
    check(await p.isVisible('[data-act="ntf-rep"][data-id="1"]') && !(await p.$('[data-act="ntf-rem"]')), "the admin without a column: only the evening report");
    check(await p.getAttribute('[data-act="ntf-rep"][data-id="0"]', "aria-pressed") === "true", "off by default");
    await p.click('[data-act="ntf-rep"][data-id="1"]'); await p.waitForTimeout(1500);
    const N = s.db.notify || {};
    check(N.prefs && N.prefs[OWNER] && N.prefs[OWNER].report === true && N.subs.some((x) => x.user === OWNER), "saved and this browser subscribed: " + JSON.stringify(N.prefs));
    check(await p.getAttribute('[data-act="ntf-rep"][data-id="1"]', "aria-pressed") === "true", "shown on");
    check(!s.errors.length, "no page errors: " + s.errors.join(" | "));
  } finally { await s.close(); }
  // an agent: no PDF, no report
  const a = await open(AGENT, { db: seed(), viewport: { width: 390, height: 844 } });
  try {
    const p = a.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2000);
    await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(500);
    check(!(await p.$('[data-act="pdf"]')), "an agent has no PDF button");
    await p.click('#tabs [data-tab="readers"]'); await p.waitForTimeout(300);
    check(!(await p.$('#top [data-act="set-sec"][data-id="notify"]')), "an agent has no Bildirişlər");
  } finally { await a.close(); }
};

// T-02 long run: one page open without reload, continuous realistic actions (tabs, days, opening and closing
// windows, creating and cancelling bookings, other phones' changes arriving), JS heap measured every minute.
//   node tests/perf/soak.js <out.json> [minutes=60]
// Criterion: heap growth after stabilisation (first 10 % of the run) ≤ 10 %, 0 page errors, 0 console errors.
// The test itself must not hold page objects: locator().waitFor() instead of waitForSelector(), whose element
// handle kept every closed window alive (stage 7: the 14.6 % «growth» of the first run was the test's own handles).
const fs = require("fs");
const { open, AGENT, uuid, bakuToday, R1, R2 } = require("../lib");
const { summary, diff } = require("./heapsum");   // SOAK_SNAP=1: what grows (heap snapshot at stabilisation and at the end)
(async () => {
  const out = process.argv[2], minutes = +process.argv[3] || 60, t0 = Date.now();
  const s = await open(AGENT, { viewport: { width: 412, height: 860 } });
  const p = s.page, cdp = await p.context().newCDPSession(p), cons = [], samples = [];
  p.on("console", (m) => { if (m.type() === "error") cons.push(m.text()); });
  // which requests failed (method, path and status only — never bodies), to explain «Failed to load resource»
  const failed = {}; p.on("response", (r) => { if (r.status() >= 400) { const u = new URL(r.url()); const k = r.request().method() + " " + u.pathname + " " + r.status(); failed[k] = (failed[k] || 0) + 1; } });
  p.setDefaultTimeout(3000);   // a missing button is skipped at once (before: 30 s waits left the page idle most of the run)
  await p.locator("#cal .ev").first().waitFor(); await p.waitForTimeout(3300);
  await cdp.send("HeapProfiler.enable");
  const heap = async () => { await cdp.send("HeapProfiler.collectGarbage"); const m = await cdp.send("Runtime.getHeapUsage"); return m.usedSize; };
  let actions = 0, i = 0, next = Date.now(), snap0 = null;
  const steps = [
    async () => p.click('#tabs [data-tab="stats"]'), async () => p.click('#tabs [data-tab="cash"]'), async () => p.click('#tabs [data-tab="patients"]'),
    async () => p.click('#tabs [data-tab="day"]'), async () => p.click('[data-act="go"][data-n="1"], .navbtn >> nth=1').catch(() => {}),
    async () => { await p.click('#tabs [data-tab="day"]'); await p.click("#fab"); await p.locator("#f-reader").first().waitFor({ timeout: 5000 }); await p.selectOption("#f-reader", R2); await p.fill("#f-time", "0" + (8 + (i % 2)) + ":00"); await p.fill("#f-name", "Soak " + i); await p.fill("#f-phone", "050 000 00 " + String(i % 100).padStart(2, "0")); await p.click('[data-act="save-appt"]'); },
    async () => { const a = s.db.appts.find((x) => /^Soak/.test(x.name) && x.status === "wait"); if (a) { a.status = "cancel"; } },
    async () => { s.db.appts.push({ id: uuid(), reader_id: R1, date: bakuToday(0), time: "20:00", duration: 30, name: "Başqa telefon " + i, phone: "050", price: 130, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: AGENT, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }); s.db.appts = s.db.appts.filter((x) => !/^Başqa telefon/.test(x.name) || x.name === "Başqa telefon " + i); },
    async () => { await p.click("#cal .ev >> nth=0").catch(() => {}); await p.waitForTimeout(200); await p.click('[data-act="close"]').catch(() => {}); },
    async () => p.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))),
  ];
  // keep the made-up database from growing forever: old soak bookings are removed (as if deleted elsewhere)
  while (Date.now() - t0 < minutes * 60000) {
    try { await steps[i % steps.length](); actions++; } catch (e) { }
    await p.click('[data-act="draft-drop"]', { timeout: 300 }).catch(() => {});
    if (s.db.appts.length > 60) s.db.appts.splice(4, s.db.appts.length - 60);
    i++; await p.waitForTimeout(250);
    if (Date.now() >= next) { samples.push({ min: +((Date.now() - t0) / 60000).toFixed(1), heap: await heap(), dom: await p.evaluate(() => document.getElementsByTagName("*").length) }); next += 60000;
      if (process.env.SOAK_SNAP && !snap0 && samples.length === Math.max(2, Math.floor(minutes * 0.1) + 1)) snap0 = await summary(cdp); }
  }
  if (process.env.SOAK_SNAP && snap0) { const d = diff(snap0, await summary(cdp)); fs.writeFileSync(out.replace(/\.json$/, "") + "-heapdiff.json", JSON.stringify(d, null, 1)); }
  const stable = samples[Math.max(1, Math.floor(samples.length * 0.1))] || samples[0], last = samples[samples.length - 1];
  const growth = stable ? (last.heap - stable.heap) / stable.heap : 0;
  const res = { at: new Date().toISOString(), minutes: +((Date.now() - t0) / 60000).toFixed(1), actions, samples, heapAfterStabilisation: stable && stable.heap, heapEnd: last && last.heap, growthPct: +(growth * 100).toFixed(1), failedRequests: failed, pageErrors: s.errors, consoleErrors: cons.slice(0, 50), verdict: growth <= 0.1 && !s.errors.length && !cons.length ? "ПРОЙДЕНО" : "НЕ ПРОЙДЕНО" };
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
  console.log(res.minutes + " min, " + actions + " actions, heap growth " + res.growthPct + " %, page errors " + s.errors.length + ", console errors " + cons.length + " — " + res.verdict);
  await s.close();
  process.exit(res.verdict === "ПРОЙДЕНО" ? 0 : 1);
})();

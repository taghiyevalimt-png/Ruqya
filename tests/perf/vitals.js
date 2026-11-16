// Web vitals on the profile "average phone, slow network" — run: node tests/perf/vitals.js <out.json> [runs=5]
// Profile (same as Lighthouse mobile "Slow 4G"): CPU slowed 4x (CDP Emulation.setCPUThrottlingRate), network
// latency 150 ms, 1.6 Mbit/s down, 0.75 Mbit/s up (CDP Network.emulateNetworkConditions), viewport 412x823, DPR 2.
// The app's own files come from a local server through the throttled network; Supabase is the in-browser fake of
// tests/lib.js (answers without network delay), so the numbers cover the page itself, not the database link.
// LCP: last largest-contentful-paint entry after the app is drawn; CLS: sum of layout-shift entries without recent
// input; INP: the longest event-timing entry over 8 real interactions (tabs, opening and closing a window, typing) —
// with fewer than 50 interactions INP equals the longest one. Long frames: long-animation-frame entries > 50 ms
// while scrolling the calendar and opening a window. Budget: page weight and request count at load.
const fs = require("fs"), path = require("path");
const { open, AGENT } = require("../lib");
const BUDGET = { lcp: 2500, inp: 200, cls: 0.1, bytes: 521000, requests: 14 };   // bytes/requests: baseline 2026-11-16 (473767 B, 12) + 10 %

async function once() {
  const s = await open(AGENT, { viewport: { width: 412, height: 823 }, noWait: true });
  const p = s.page, cdp = await p.context().newCDPSession(p);
  let bytes = 0, reqs = 0;
  try {
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 0.75e6 / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    p.on("response", async (r) => { if (r.url().startsWith(s.base)) { reqs++; try { bytes += (await r.body()).length; } catch (e) {} } });
    await p.addInitScript(() => {
      window.__v = { lcp: 0, cls: 0, ev: [], laf: [] };
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__v.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__v.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) window.__v.ev.push([e.name, Math.round(e.duration)]); }).observe({ type: "event", buffered: true, durationThreshold: 16 });
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__v.laf.push(Math.round(e.duration)); }).observe({ type: "long-animation-frame", buffered: true }); } catch (e) {}
    });
    const t0 = Date.now();
    await p.reload({ waitUntil: "load" });
    await p.waitForSelector("#cal .ev", { timeout: 60000 });
    const ready = Date.now() - t0;
    await p.waitForFunction(() => document.documentElement.classList.contains("ready"), null, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(800);
    const lcp = await p.evaluate(() => window.__v.lcp);
    await p.evaluate(() => { window.__v.laf = []; });
    // interactions
    await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(300);
    await p.click('#tabs [data-tab="cash"]'); await p.waitForTimeout(300);
    await p.click('#tabs [data-tab="patients"]'); await p.waitForTimeout(300);
    await p.click('#tabs [data-tab="day"]'); await p.waitForTimeout(300);
    await p.click("#fab"); await p.waitForTimeout(400);
    await p.click("#f-name"); await p.keyboard.type("Test"); await p.waitForTimeout(200);
    await p.click('[data-act="close"]'); await p.waitForTimeout(400);
    await p.click('[data-act="draft-drop"]').catch(() => {});
    for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 300); await p.waitForTimeout(120); }
    await p.waitForTimeout(500);
    const v = await p.evaluate(() => window.__v);
    const inp = v.ev.reduce((m, e) => Math.max(m, e[1]), 0);
    return { lcp: Math.round(lcp), cls: +v.cls.toFixed(4), inp, longFrames50: v.laf.filter((d) => d > 50), readyMs: ready, bytes, requests: reqs, events: v.ev, errors: s.errors };
  } finally { await s.close(); }
}

(async () => {
  const outFile = process.argv[2], n = +process.argv[3] || 5, runs = [];
  for (let i = 0; i < n; i++) { const r = await once(); runs.push(r); console.log("run " + (i + 1) + ": LCP " + r.lcp + " ms, INP " + r.inp + " ms, CLS " + r.cls + ", long frames >50ms " + r.longFrames50.length + ", " + r.requests + " requests, " + r.bytes + " bytes"); }
  const med = (k) => { const a = runs.map((r) => r[k]).sort((x, y) => x - y); return { median: a[Math.floor(a.length / 2)], min: a[0], max: a[a.length - 1] }; };
  const sum = { at: new Date().toISOString(), profile: "CPU x4, 150 ms latency, 1.6/0.75 Mbit/s, 412x823 DPR2, Chrome (playwright-core)", runs: n, lcp: med("lcp"), inp: med("inp"), cls: med("cls"), bytes: med("bytes"), requests: med("requests"), readyMs: med("readyMs"), longFramesOver50ms: runs.map((r) => r.longFrames50.length), budget: BUDGET, detail: runs };
  const fail = [];
  if (sum.lcp.median > BUDGET.lcp) fail.push("LCP"); if (sum.inp.median > BUDGET.inp) fail.push("INP"); if (sum.cls.median > BUDGET.cls) fail.push("CLS");
  if (sum.bytes.median > BUDGET.bytes) fail.push("bytes budget"); if (sum.requests.median > BUDGET.requests) fail.push("request budget");
  sum.verdict = fail.length ? "НЕ ПРОЙДЕНО: " + fail.join(", ") : "ПРОЙДЕНО";
  fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, JSON.stringify(sum, null, 1));
  console.log("median LCP " + sum.lcp.median + " (" + sum.lcp.min + "–" + sum.lcp.max + ") ms; INP " + sum.inp.median + " (" + sum.inp.min + "–" + sum.inp.max + ") ms; CLS " + sum.cls.median + "; " + sum.requests.median + " requests; " + sum.bytes.median + " bytes — " + sum.verdict);
  process.exit(fail.length ? 1 : 0);
})();

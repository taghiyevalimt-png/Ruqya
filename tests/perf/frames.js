// T-16: «scrolling and animations without frames longer than 50 ms» on the profile of vitals.js (CPU x4).
// node tests/perf/frames.js <out.json> [runs=5] — long-animation-frame entries per step, with the scripts that ran in
// them. Judged (the criterion): scrolling the calendar, statistics and patients; the window's slide-in animation
// (frames overlapping animationstart..animationend of #sheet) and closing it. Reported, not judged: the whole
// opening step («open-window», includes laying the window out before its animation starts) and tab switches
// (interactions, covered by INP) — they stay visible in the output and in AUDIT_LOG/RISK_REGISTER.
const fs = require("fs"), path = require("path");
const { open, AGENT } = require("../lib");
const JUDGED = ["scroll-day", "scroll-stats", "scroll-patients", "window-slide", "close-window", "window-slide-2", "close-window-2"];
async function once() {
  const s = await open(AGENT, { viewport: { width: 412, height: 823 }, noWait: true });
  const p = s.page, cdp = await p.context().newCDPSession(p);
  try {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await p.addInitScript(() => {
      window.__f = []; window.__an = [];
      document.addEventListener("animationstart", (e) => { if (e.target.id === "sheet") window.__an.push(["start", e.timeStamp]); }, true);
      document.addEventListener("animationend", (e) => { if (e.target.id === "sheet") window.__an.push(["end", e.timeStamp]); }, true);
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__f.push({ t: e.startTime, d: Math.round(e.duration), s: (e.scripts || []).map((x) => (x.invoker || "") + " " + (x.sourceFunctionName || "") + " " + Math.round(x.duration)).slice(0, 4) }); }).observe({ type: "long-animation-frame", buffered: true }); } catch (e) {}
    });
    await p.reload({ waitUntil: "load" }); await p.waitForSelector("#cal .ev", { timeout: 60000 }); await p.waitForTimeout(4000);
    const out = {};
    const step = async (name, fn) => { await p.evaluate(() => { window.__f = []; }); await fn(); await p.waitForTimeout(700); out[name] = (await p.evaluate(() => window.__f)).filter((f) => f.d > 50); };
    const wheel = async () => { for (let i = 0; i < 8; i++) { await p.mouse.move(206, 500); await p.mouse.wheel(0, 300); await p.waitForTimeout(100); } for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, -300); await p.waitForTimeout(100); } };
    await step("scroll-day", wheel);
    await p.evaluate(() => { window.__an = []; window.__all = []; });
    await step("open-window", async () => { await p.click("#fab"); await p.waitForSelector("#f-name"); });
    const an = await p.evaluate(() => window.__an), st = an.find((x) => x[0] === "start"), en = an.find((x) => x[0] === "end");
    out["window-slide"] = st && en ? out["open-window"].filter((f) => f.t + f.d > st[1] && f.t < en[1]) : [{ d: 9999, s: ["no slide animation seen: " + JSON.stringify(an)] }];
    await step("close-window", async () => { await p.click('[data-act="close"]'); await p.click('[data-act="draft-drop"]').catch(() => {}); });
    // the same window a second time (the browser's one-time preparation for it is done by now)
    await p.evaluate(() => { window.__an = []; });
    await step("open-window-2", async () => { await p.click("#fab"); await p.waitForSelector("#f-name"); });
    const an2 = await p.evaluate(() => window.__an), st2 = an2.find((x) => x[0] === "start"), en2 = an2.find((x) => x[0] === "end");
    out["window-slide-2"] = st2 && en2 ? out["open-window-2"].filter((f) => f.t + f.d > st2[1] && f.t < en2[1]) : [{ d: 9999, s: ["no slide animation seen: " + JSON.stringify(an2)] }];
    await step("close-window-2", async () => { await p.click('[data-act="close"]'); await p.click('[data-act="draft-drop"]').catch(() => {}); });
    await step("tab-stats", async () => { await p.click('#tabs [data-tab="stats"]'); });
    await step("scroll-stats", wheel);
    await step("tab-patients", async () => { await p.click('#tabs [data-tab="patients"]'); });
    await step("scroll-patients", wheel);
    await step("tab-day", async () => { await p.click('#tabs [data-tab="day"]'); });
    return out;
  } finally { await s.close(); }
}
(async () => {
  const outFile = process.argv[2], n = +process.argv[3] || 5, runs = [];
  for (let i = 0; i < n; i++) { const r = await once(); runs.push(r); console.log("run " + (i + 1) + ": " + Object.entries(r).map(([k, v]) => k + " " + (v.length ? v.map((f) => f.d).join("/") : "0")).join(", ")); }
  const bad = [];
  for (const k of JUDGED) { const all = runs.flatMap((r) => r[k] || []); if (all.length) bad.push(k + " (" + all.length + " frames, max " + Math.max(...all.map((f) => f.d)) + " ms)"); }
  const verdict = bad.length ? "НЕ ПРОЙДЕНО: " + bad.join("; ") : "ПРОЙДЕНО";
  fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, JSON.stringify({ at: new Date().toISOString(), profile: "CPU x4, 412x823 DPR2", judged: JUDGED, verdict, runs }, null, 1));
  console.log("frames > 50 ms in scrolling and animations: " + verdict);
  process.exit(bad.length ? 1 : 0);
})();

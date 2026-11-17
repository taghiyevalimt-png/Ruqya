// T-16: «scrolling and animations without frames longer than 50 ms» on the profile of vitals.js (CPU x4).
// node tests/perf/frames.js <out.json> [runs=5] — long-animation-frame entries per step, with the scripts that ran in
// them. Judged (the criterion, stage 7 R2-3): every frame > 50 ms while scrolling (calendar, statistics, patients),
// and every frame > 50 ms that overlaps a running CSS animation of the page (window slide-in, overlay fade, section
// fade-in after a tab switch, toast...), whatever started it. Frames of a step with no animation running and no
// scrolling are reported only («other»).
const fs = require("fs"), path = require("path");
const { open, AGENT } = require("../lib");
async function once() {
  const s = await open(AGENT, { viewport: { width: 412, height: 823 }, noWait: true });
  const p = s.page, cdp = await p.context().newCDPSession(p);
  try {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await p.addInitScript(() => {
      window.__f = []; window.__an = [];
      const key = (e) => (e.target.id || e.target.className || e.target.tagName) + ":" + e.animationName;
      document.addEventListener("animationstart", (e) => window.__an.push([key(e), "start", e.timeStamp]), true);
      document.addEventListener("animationend", (e) => window.__an.push([key(e), "end", e.timeStamp]), true);
      document.addEventListener("animationcancel", (e) => window.__an.push([key(e), "end", e.timeStamp]), true);
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__f.push({ t: e.startTime, d: Math.round(e.duration), s: (e.scripts || []).map((x) => (x.invoker || "") + " " + (x.sourceFunctionName || "") + " " + Math.round(x.duration)).slice(0, 4) }); }).observe({ type: "long-animation-frame", buffered: true }); } catch (e) {}
    });
    await p.reload({ waitUntil: "load" }); await p.waitForSelector("#cal .ev", { timeout: 60000 }); await p.waitForTimeout(4000);
    const out = {};
    // a step: its long frames, split into judged (scrolling, or overlapping an animation) and other
    const step = async (name, fn, scrolling) => {
      await p.evaluate(() => { window.__f = []; window.__an = []; });
      await fn(); await p.waitForTimeout(900);
      const { f, an } = await p.evaluate(() => ({ f: window.__f, an: window.__an, now: performance.now() }));
      const open = {}, iv = [];
      for (const [k, ev, t] of an) { if (ev === "start") open[k] = t; else if (open[k] !== undefined) { iv.push([k, open[k], t]); delete open[k]; } }
      for (const k of Object.keys(open)) iv.push([k, open[k], Infinity]);
      const long = f.filter((x) => x.d > 50);
      const hit = (x) => iv.filter(([, a, b]) => x.t + x.d > a && x.t < b).map(([k]) => k);
      out[name] = { judged: long.filter((x) => scrolling || hit(x).length).map((x) => ({ ...x, during: scrolling ? ["scroll"] : hit(x) })), other: long.filter((x) => !scrolling && !hit(x).length), animations: [...new Set(iv.map(([k]) => k))] };
    };
    const wheel = async () => { for (let i = 0; i < 8; i++) { await p.mouse.move(206, 500); await p.mouse.wheel(0, 300); await p.waitForTimeout(100); } for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, -300); await p.waitForTimeout(100); } };
    const closeWin = async () => { await p.click('[data-act="close"]'); await p.click('[data-act="draft-drop"]', { timeout: 800 }).catch(() => {}); };
    await step("scroll-day", wheel, true);
    await step("open-window", async () => { await p.click("#fab"); await p.waitForSelector("#f-name"); });
    await step("close-window", closeWin);
    await step("open-window-2", async () => { await p.click("#fab"); await p.waitForSelector("#f-name"); });
    await step("close-window-2", closeWin);
    await step("tab-stats", async () => { await p.click('#tabs [data-tab="stats"]'); });
    await step("scroll-stats", wheel, true);
    await step("tab-patients", async () => { await p.click('#tabs [data-tab="patients"]'); });
    await step("scroll-patients", wheel, true);
    await step("tab-day", async () => { await p.click('#tabs [data-tab="day"]'); });
    return out;
  } finally { await s.close(); }
}
(async () => {
  const outFile = process.argv[2], n = +process.argv[3] || 5, runs = [];
  for (let i = 0; i < n; i++) {
    const r = await once(); runs.push(r);
    console.log("run " + (i + 1) + ": " + Object.entries(r).map(([k, v]) => k + " " + (v.judged.length ? v.judged.map((f) => f.d).join("/") : "0") + (v.other.length ? " (other " + v.other.map((f) => f.d).join("/") + ")" : "")).join(", "));
  }
  const bad = [];
  for (const k of Object.keys(runs[0])) { const all = runs.flatMap((r) => r[k].judged); if (all.length) bad.push(k + " (" + all.length + " frames in " + runs.filter((r) => r[k].judged.length).length + "/" + n + " runs, max " + Math.max(...all.map((f) => f.d)) + " ms, during " + [...new Set(all.flatMap((f) => f.during))].join(",") + ")"); }
  const verdict = bad.length ? "НЕ ПРОЙДЕНО: " + bad.join("; ") : "ПРОЙДЕНО";
  fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, JSON.stringify({ at: new Date().toISOString(), profile: "CPU x4, 412x823 DPR2", verdict, runs }, null, 1));
  console.log("frames > 50 ms in scrolling and animations: " + verdict);
  process.exit(bad.length ? 1 : 0);
})();

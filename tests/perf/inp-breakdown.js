// Where does an interaction's time go (CPU x4)? input delay / processing / presentation (style, layout, paint).
//   node tests/perf/inp-breakdown.js <selector> [prep-selector]
const { open, AGENT, OWNER } = require("../lib");
(async () => {
  const s = await open(process.env.WHO === "owner" ? OWNER : AGENT, { viewport: { width: 412, height: 823 } });
  const p = s.page, cdp = await p.context().newCDPSession(p);
  await p.waitForSelector("#cal .ev"); await p.waitForTimeout(3300);
  if (process.argv[3]) { await p.click(process.argv[3]); await p.waitForTimeout(500); }
  await p.evaluate(() => { window.__e = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === "click") window.__e.push({ dur: Math.round(e.duration), delay: Math.round(e.processingStart - e.startTime), proc: Math.round(e.processingEnd - e.processingStart), pres: Math.round(e.startTime + e.duration - e.processingEnd) }); }).observe({ type: "event", durationThreshold: 16 }); });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await p.click(process.argv[2]); await p.waitForTimeout(800);
  console.log(process.argv[2], JSON.stringify(await p.evaluate(() => window.__e)), "DOM nodes:", await p.evaluate(() => document.getElementsByTagName("*").length));
  await s.close();
})();

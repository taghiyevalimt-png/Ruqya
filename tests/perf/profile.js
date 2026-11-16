// CPU profile of one interaction (CPU x4): node tests/perf/profile.js <selector-to-click> [prep-selector]
const { open, AGENT, OWNER } = require("../lib");
(async () => {
  const s = await open(process.env.WHO === "owner" ? OWNER : AGENT, { viewport: { width: 412, height: 823 } });
  const p = s.page, cdp = await p.context().newCDPSession(p);
  await p.waitForSelector("#cal .ev"); await p.waitForTimeout(3300);
  if (process.argv[3]) { await p.click(process.argv[3]); await p.waitForTimeout(500); }
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 100 }); await cdp.send("Profiler.start");
  const t = Date.now(); await p.click(process.argv[2]); await p.waitForTimeout(600);
  const { profile } = await cdp.send("Profiler.stop");
  const self = {}, byId = {}; profile.nodes.forEach((n) => (byId[n.id] = n));
  const dt = profile.timeDeltas; profile.samples.forEach((id, i) => { const n = byId[id], k = n.callFrame.functionName + " @" + n.callFrame.lineNumber; self[k] = (self[k] || 0) + (dt[i] || 0) / 1000; });
  console.log(Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => v.toFixed(1) + " ms  " + k).join("\n"));
  await s.close();
})();

// Rendering work of one interaction (CPU x4): sums of devtools.timeline events (style, layout, paint...).
const { open, AGENT, OWNER } = require("../lib");
(async () => {
  const s = await open(process.env.WHO === "owner" ? OWNER : AGENT, { viewport: { width: 412, height: 823 } });
  const p = s.page, cdp = await p.context().newCDPSession(p);
  await p.waitForSelector("#cal .ev"); await p.waitForTimeout(3300);
  if (process.argv[3]) { await p.click(process.argv[3]); await p.waitForTimeout(500); }
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const ev = []; cdp.on("Tracing.dataCollected", (d) => ev.push(...d.value));
  const done = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
  await cdp.send("Tracing.start", { categories: "devtools.timeline,disabled-by-default-devtools.timeline", transferMode: "ReportEvents" });
  await p.click(process.argv[2]); await p.waitForTimeout(800);
  await cdp.send("Tracing.end"); await done;
  const sum = {}; for (const e of ev) if (e.ph === "X" && e.dur) sum[e.name] = (sum[e.name] || 0) + e.dur / 1000;
  console.log(Object.entries(sum).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => v.toFixed(1) + " ms  " + k).join("\n"));
  await s.close();
})();

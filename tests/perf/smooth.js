// 23.11 (owner: «make every movement as smooth as possible»): frame-by-frame timing of the moves people see most —
// opening and closing a window, switching tabs, scrolling the calendar — on a phone-like profile (CPU ×4).
// Counts frames longer than 25 ms (at least one frame dropped at 60 fps) and the longest frame; prints one line per run.
//   node tests/perf/smooth.js [runs=3]
const { open, AGENT } = require("../lib");
async function once() {
  const s = await open(AGENT, { viewport: { width: 412, height: 823 } });
  const p = s.page, cdp = await p.context().newCDPSession(p);
  try {
    await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3500);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const rec = async (name, fn, ms) => {
      await p.evaluate(() => { window.__t = []; window.__on = true; const f = (t) => { if (!window.__on) return; window.__t.push(t); requestAnimationFrame(f); }; requestAnimationFrame(f); });
      await fn(); await p.waitForTimeout(ms);
      const t = await p.evaluate(() => { window.__on = false; return window.__t; });
      const d = []; for (let i = 1; i < t.length; i++) d.push(t[i] - t[i - 1]);
      return { name, frames: d.length, slow: d.filter((x) => x > 25).length, worst: Math.round(Math.max(0, ...d)) };
    };
    const out = [];
    out.push(await rec("open", async () => { await p.click("#fab"); }, 900));
    out.push(await rec("close", async () => { await p.click('[data-act="close"]'); }, 700));
    if (await p.locator('[data-act="draft-drop"]').count()) await p.click('[data-act="draft-drop"]');
    out.push(await rec("open-2", async () => { await p.click("#fab"); }, 900));
    out.push(await rec("close-2", async () => { await p.click('[data-act="close"]'); }, 700));
    if (await p.locator('[data-act="draft-drop"]').count()) await p.click('[data-act="draft-drop"]');
    out.push(await rec("tab-stats", async () => { await p.click('#tabs [data-tab="stats"]'); }, 900));
    out.push(await rec("tab-day", async () => { await p.click('#tabs [data-tab="day"]'); }, 900));
    out.push(await rec("scroll", async () => { await p.mouse.move(200, 500); for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 250); await p.waitForTimeout(60); } }, 600));
    out.push(await rec("idle-day", async () => {}, 1500));   // nothing happens: the screen should not repaint
    return out;
  } finally { await s.close(); }
}
(async () => {
  const runs = +process.argv[2] || 3;
  for (let r = 0; r < runs; r++) { const o = await once(); console.log("run " + (r + 1) + ": " + o.map((x) => x.name + " " + x.slow + "/" + x.frames + " slow, worst " + x.worst + "ms").join("; ")); }
})();

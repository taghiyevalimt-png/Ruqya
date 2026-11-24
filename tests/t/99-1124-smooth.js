// Owner 24.11: «even on very old Android everything smooth, as if 120 fps — especially when a window opens (the booking
// window, the products to sell…)». Weak phones (Android below 10, ≤ 3 GB, ≤ 4 cores, or slow frames once seen) get the
// light motion: the window glides up as ONE piece (transform only; the fields do not come in one by one, no shadows),
// with no restyle of its fields at the start, and the focus is set after the glide, not in the middle of it.
// A new Android phone keeps the full motion. Frames are counted with the CPU slowed down (×6 weak, ×4 new).
const { open, check, AGENT, seed } = require("../lib");
const ua = (v) => [(u) => { Object.defineProperty(navigator, "userAgent", { get: () => u }); Object.defineProperty(navigator, "deviceMemory", { get: () => 8 }); Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 }); }, "Mozilla/5.0 (Linux; Android " + v + "; SM-A105F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36"];
module.exports = async () => {
  for (const [v, lite] of [["9", true], ["14", false]]) {
    const s = await open(AGENT, { db: seed(), viewport: { width: 360, height: 740 }, init: ua(v) });
    try {
      const p = s.page, cdp = await p.context().newCDPSession(p);
      await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
      check(await p.evaluate(() => document.documentElement.classList.contains("lite")) === lite, "Android " + v + ": light motion " + lite);
      await p.click('#tabs [data-tab="day"]'); await p.waitForTimeout(400);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: lite ? 6 : 4 });   // a weak phone ×6, a new one ×4
      await p.evaluate(() => { window.__t = []; window.__on = true; const f = (t) => { if (!window.__on) return; window.__t.push(t); requestAnimationFrame(f); }; requestAnimationFrame(f); });
      await p.click("#fab");
      const at0 = await p.evaluate(() => ({ focus: document.activeElement && document.activeElement.id, anim: getComputedStyle(document.getElementById("sheet")).animationName, kids: [...document.getElementById("sheet").children].slice(1, 6).map((c) => getComputedStyle(c).animationName), opening: document.getElementById("sheet").classList.contains("opening") }));
      await p.waitForTimeout(900);
      const r = await p.evaluate(() => { window.__on = false; return { t: window.__t, focus: document.activeElement && document.activeElement.id }; });
      const d = []; for (let i = 1; i < r.t.length; i++) d.push(r.t[i] - r.t[i - 1]);
      const k0 = d.indexOf(Math.max(...d)), glide = d.slice(k0 + 1).filter((x) => x > 40).length;   // after the frame that builds the window
      check(/sheetIn/.test(at0.anim), v + ": the window glides up (24.11 evening: sheetIn on every phone): " + at0.anim);
      check(at0.focus !== "sheet" && r.focus === "sheet", v + ": the focus goes to the window after the glide, not at once: " + JSON.stringify([at0.focus, r.focus]));
      // 24.11 evening (owner's video): one piece on EVERY phone, new ones too — the fields never come in one by one
      check(at0.kids.every((k) => k === "none") && !at0.opening, v + ": one piece — the fields do not come in one by one: " + JSON.stringify(at0));
      check(glide <= 2, v + ": at most 2 dropped frames during the glide on a slow CPU: " + glide + " " + JSON.stringify(d.map(Math.round)));
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      check(!s.errors.length, "no page errors: " + s.errors.join("; "));
    } finally { await s.close(); }
  }
};

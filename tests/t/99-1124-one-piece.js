// Owner 24.11 (video IMG_3321: on some phones a window opened slowly and ugly — its fields washed-out, fading in one
// by one): on EVERY phone (weak or new, Android 9 and 14, iPhone) a window slides up as ONE piece, fast, by transform
// only; nothing inside it fades or moves; no soft shadow; closing slides it away. Measured with the CPU slowed ×6
// (an old phone): from the tap the window is in place within 0.45 s with at most 2 long frames after the one that builds it.
const { open, check, AGENT, seed } = require("../lib");
const ua = (u) => [(u) => { Object.defineProperty(navigator, "userAgent", { get: () => u }); Object.defineProperty(navigator, "deviceMemory", { get: () => 8 }); Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 }); }, u];
const UAS = { "Android 14": "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  "Android 9": "Mozilla/5.0 (Linux; Android 9; SM-J600F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  "iPhone": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" };
module.exports = async () => {
  for (const name of Object.keys(UAS)) {
    const s = await open(AGENT, { db: seed(), viewport: { width: 360, height: 740 }, init: ua(UAS[name]) });
    try {
      const p = s.page, cdp = await p.context().newCDPSession(p);
      await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
      await p.click('#tabs [data-tab="day"]'); await p.waitForTimeout(400);
      for (const [what, sel] of [["booking", "#fab"], ["a booking's details", '[data-act="view-appt"]']]) {
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
        await p.evaluate(() => { window.__t = []; window.__on = true; window.__t0 = performance.now(); const f = (t) => { if (!window.__on) return; window.__t.push(t); requestAnimationFrame(f); }; requestAnimationFrame(f); });
        await p.click(sel);
        const a = await p.evaluate(() => { const sh = document.getElementById("sheet"), cs = getComputedStyle(sh);
          return { anim: cs.animationName, dur: cs.animationDuration, shadow: cs.boxShadow, opening: sh.classList.contains("opening"),
            kids: [...sh.children].map((c) => getComputedStyle(c).animationName).filter((n) => n !== "none") }; });
        await p.waitForTimeout(1200);
        const r = await p.evaluate(() => { window.__on = false; const sh = document.getElementById("sheet"); return { t: window.__t, t0: window.__t0, tr: getComputedStyle(sh).transform }; });
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
        const d = []; for (let i = 1; i < r.t.length; i++) d.push(r.t[i] - r.t[i - 1]);
        const k0 = d.indexOf(Math.max(...d)), after = d.slice(k0 + 1), long = after.filter((x) => x > 40).length;
        const tag = name + ", " + what + ": ";
        check(a.anim === "sheetIn" && parseFloat(a.dur) <= 0.25, tag + "slides up as one piece, fast: " + a.anim + " " + a.dur);
        check(!a.opening && a.kids.length === 0, tag + "nothing inside fades or moves: " + JSON.stringify(a.kids));
        check(a.shadow === "none", tag + "no soft shadow to draw: " + a.shadow);
        check(long <= 2, tag + "at most 2 long frames after the build frame, CPU ×6: " + long + " " + JSON.stringify(d.map(Math.round)));
        check(r.tr === "none" || /matrix\(1, 0, 0, 1, 0, 0\)/.test(r.tr), tag + "in place at the end: " + r.tr);
        await p.click('#sheet [data-act="close"]').catch(() => {}); await p.waitForTimeout(500);
        check(await p.evaluate(() => !document.querySelector(".ghostout") && document.getElementById("overlay").hidden), tag + "closed and gone");
      }
      check(!s.errors.length, name + ": no page errors: " + s.errors.join("; "));
    } finally { await s.close(); }
  }
};

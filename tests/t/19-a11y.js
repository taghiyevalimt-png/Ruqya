// T-25: keyboard use with a visible focus, 200 % zoom (1280 px screen → 640 CSS px), «reduce motion».
const { open, check, OWNER } = require("../lib");
module.exports = async () => {
  // keyboard: Tab reaches the bottom tabs and the «+ Yaz» button, every focused control shows a focus ring,
  // Enter on a focused tab opens it, Escape/× closes a window
  let s = await open(OWNER, { viewport: { width: 1280, height: 800 } });
  try {
    const p = s.page;
    await p.waitForSelector("#cal .ev", { timeout: 15000 }); await p.waitForTimeout(3300);
    const seen = new Set(); let noRing = [];
    for (let i = 0; i < 60; i++) {
      await p.keyboard.press("Tab");
      const f = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); const ring = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || /rgb/.test(cs.boxShadow); return { k: (e.dataset.act || e.tagName) + "|" + (e.dataset.tab || e.dataset.id || e.id || ""), ring }; });
      if (!f) continue; seen.add(f.k); if (!f.ring) noRing.push(f.k);
    }
    check([...seen].some((k) => /^tab\|stats/.test(k)), "Tab reaches the Statistika tab: " + [...seen].slice(0, 12).join(", "));
    check([...seen].some((k) => /^new-appt/.test(k)), "Tab reaches «+ Yaz»");
    check(noRing.length === 0, "every focused control shows a focus ring; without: " + [...new Set(noRing)].join(", "));
    await p.focus('#tabs [data-tab="stats"]'); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
    check(/Statistika/.test(await p.textContent("#top")), "Enter opens a tab");
    await p.focus("#fab").catch(() => {}); await p.click('#tabs [data-tab="day"]'); await p.waitForTimeout(300); await p.focus("#fab"); await p.keyboard.press("Enter"); await p.waitForSelector("#f-reader");
    await p.keyboard.press("Escape"); await p.waitForTimeout(300);
    const closedByEsc = await p.locator("#overlay").isHidden();
    if (!closedByEsc) { await p.click('[data-act="close"]'); }
    check(closedByEsc, "Escape closes the window");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
  // 200 % zoom on a 1280 px screen = 640 CSS px wide: nothing scrolls sideways
  s = await open(OWNER, { viewport: { width: 640, height: 400 } });
  try {
    const p = s.page; await p.waitForSelector("#cal .ev", { timeout: 15000 }); await p.waitForTimeout(3300);
    for (const t of ["day", "stats", "cash", "patients", "readers"]) { await p.click('#tabs [data-tab="' + t + '"]'); await p.waitForTimeout(300); const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); check(o <= 1, "200 % zoom, tab " + t + ": page " + o + " px wider than the screen"); }
  } finally { await s.close(); }
  // «reduce motion»: animations of windows and the splash are short or off
  s = await open(OWNER, {});
  try {
    const p = s.page; await p.emulateMedia({ reducedMotion: "reduce" }); await p.reload(); await p.waitForSelector("#fab:not([hidden])", { timeout: 20000 }); await p.waitForTimeout(3300);
    await p.click("#fab"); await p.waitForSelector("#f-reader");
    const d = await p.$eval("#sheet", (e) => { const cs = getComputedStyle(e); return Math.max(...cs.animationDuration.split(",").map(parseFloat)) * (cs.animationName === "none" ? 0 : 1); });
    check(d <= 0.2, "window animation with «reduce motion»: " + d + " s");
  } finally { await s.close(); }
};

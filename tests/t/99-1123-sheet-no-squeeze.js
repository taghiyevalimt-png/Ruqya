// Owner 23.11 (photo): in a new break with «Hər həftə: …» the day buttons were cut in half under «Təkrar». Cause: a
// window is a scrolling flex column; a block that scrolls sideways (the day buttons) could be squeezed below its height.
// Several windows on a small phone, scrolled through: no block of a window squeezed, no two blocks overlapping.
const { open, check, OWNER, seed } = require("../lib");
module.exports = async () => {
  const db = seed(); db.app_settings = [{ id: "presets", value: { price: 130 } }];
  db.products = [{ id: "cccccccc-0000-4000-8000-0000000000d1", name: "Ruqyalı su", price: 2, archived: false, sort: 1, created_at: new Date().toISOString() }];
  const s = await open(OWNER, { db, viewport: { width: 360, height: 640 } });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    const probe = () => p.evaluate(() => {
      const out = [], kids = [...document.querySelectorAll("#sheet > *")].filter((e) => e.offsetParent !== null && getComputedStyle(e).position !== "absolute" && getComputedStyle(e).position !== "fixed");
      kids.forEach((e, i) => {
        const r = e.getBoundingClientRect();
        // what is visible of the block (hidden radio inputs behind the pill buttons do not count) must fit in it
        const vis = [...e.querySelectorAll("*")].filter((c) => { const b = c.getBoundingClientRect(), cs = getComputedStyle(c); return b.width > 2 && b.height > 2 && cs.opacity !== "0" && cs.visibility !== "hidden" && !(c.tagName === "INPUT" && /radio|checkbox/.test(c.type)); });
        const bottom = Math.max(r.bottom, ...vis.map((c) => c.getBoundingClientRect().bottom));
        if (bottom > r.bottom + 1 && getComputedStyle(e).overflowY !== "auto") out.push("squeezed: " + (e.className || e.tagName) + " " + Math.round(r.height) + " (content to " + Math.round(bottom - r.top) + ")");
        // the save bar sticks to the bottom on purpose (it stays over the scrolling fields)
        const n = kids[i + 1]; if (n && getComputedStyle(n).position !== "sticky") { const q = n.getBoundingClientRect(); if (q.top < r.bottom - 1) out.push("overlap: " + (e.className || e.tagName) + " / " + (n.className || n.tagName)); }
      });
      return out;
    });
    const bad = [];
    // a new break, repeating on chosen weekdays
    await p.click('#tabs [data-tab="readers"]'); await p.click('[data-act="set-sec"][data-id="breaks"]'); await p.waitForTimeout(300);
    await p.click('[data-act="new-break"]'); await p.locator("#b-rep").waitFor(); await p.selectOption("#b-rep", "custom"); await p.waitForTimeout(400);
    (await probe()).forEach((x) => bad.push("break: " + x));
    const chip = await p.evaluate(() => { const c = document.querySelector('#sheet .wdays .chip'), w = c.closest(".wdays"); return { ch: c.getBoundingClientRect().height, wh: w.getBoundingClientRect().height }; });
    check(chip.ch >= 30 && chip.wh >= chip.ch, "the day buttons are whole: " + JSON.stringify(chip));
    await p.click('[data-act="close"]'); await p.waitForTimeout(400);
    // a new booking, the presets window, a sale
    await p.click('#tabs [data-tab="day"]'); await p.click("#fab"); await p.locator("#f-name").waitFor(); await p.waitForTimeout(500);
    (await probe()).forEach((x) => bad.push("booking: " + x));
    await p.click('[data-act="close"]'); await p.waitForTimeout(400); if (await p.locator('[data-act="draft-drop"]').count()) await p.click('[data-act="draft-drop"]');
    await p.click('#tabs [data-tab="cash"]'); await p.click('[data-act="new-prod"]'); await p.locator("#sheet .pbtn").first().waitFor(); await p.waitForTimeout(400);
    (await probe()).forEach((x) => bad.push("sale: " + x));
    check(!bad.length, "no squeezed or overlapping blocks in windows: " + bad.join(" | "));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

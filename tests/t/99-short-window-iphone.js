// Owner 17.11 (screen recording from an iPhone, 13:42): «Yeni mütəxəssis» — the window disappeared under the keyboard,
// what was typed could not be seen. On an iPhone the keyboard does NOT make the page shorter (that is Android, test
// 99-short-window-keyboard): window.innerHeight stays, only window.visualViewport becomes shorter, and a window resting
// on the bottom edge stays under the keyboard. Simulated here: visualViewport is replaced by one whose height is
// set by the test (iPhone 13: 844 px screen, keyboard ≈ 336 px → 508 px visible).
const { open, check, OWNER } = require("../lib");
module.exports = async () => {
  const s = await open(OWNER, { viewport: { width: 390, height: 844 } });
  try {
    const p = s.page;
    await p.addInitScript(() => {
      const vv = new EventTarget(); vv.height = innerHeight; vv.width = innerWidth; vv.offsetTop = 0; vv.offsetLeft = 0; vv.scale = 1; vv.pageTop = 0;
      Object.defineProperty(window, "visualViewport", { configurable: true, get: () => vv });
      window.__kb = (h) => { vv.height = innerHeight - h; vv.dispatchEvent(new Event("resize")); };
    });
    await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="spec"]').catch(() => {}); await p.waitForTimeout(300);
    await p.click('[data-act="new-reader"] >> nth=0'); await p.locator("#r-name").waitFor();
    await p.$eval("#sheet", (e) => Promise.all(e.getAnimations().map((a) => a.finished)));
    await p.click("#r-name");
    await p.evaluate(() => window.__kb(336));   // the iPhone keyboard opens: the page keeps its height
    await p.waitForTimeout(400);
    await p.keyboard.type("Yeni Mütəxəssis");
    const r = await p.evaluate(() => { const b = document.getElementById("r-name").getBoundingClientRect(), s = document.querySelector('[data-act="save-reader"]').getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), save: Math.round(s.bottom), visible: visualViewport.height, ih: innerHeight, v: document.getElementById("r-name").value }; });
    check(r.v === "Yeni Mütəxəssis", "typed: " + r.v);
    check(r.top >= 0 && r.bottom <= r.visible, "the name field is above the iPhone keyboard (visible " + r.visible + " of " + r.ih + " px): " + JSON.stringify(r));
    check(r.save <= r.visible, "the save button is above the keyboard too: " + JSON.stringify(r));
    // keyboard closes: the window goes back down to the bottom edge
    await p.evaluate(() => window.__kb(0)); await p.waitForTimeout(300);
    const down = await p.$eval("#sheet", (e) => Math.round(innerHeight - e.getBoundingClientRect().bottom));
    check(down <= 1, "after the keyboard closes the window rests on the bottom edge again: gap " + down);
    // the tall booking window is not moved by this (it stays where it opened, test 15-keyboard)
    await p.click('[data-act="close"]'); await p.waitForTimeout(400);
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

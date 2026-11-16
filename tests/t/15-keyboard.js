// The booking window does not move when the keyboard opens (Android makes the page shorter; it is simulated here).
const { open, check, AGENT } = require("../lib");
module.exports = async () => {
  const s = await open(AGENT, { viewport: { width: 412, height: 860 } });
  try {
    const p = s.page;
    await p.waitForSelector("text=Test Pasiyent", { timeout: 15000 }); await p.waitForTimeout(3200);
    await p.click("#fab"); await p.waitForSelector("#f-reader"); await p.waitForTimeout(500);
    const top0 = await p.$eval("#sheet", (e) => Math.round(e.getBoundingClientRect().top));
    await p.click("#f-name");
    await p.setViewportSize({ width: 412, height: 500 });   // keyboard opens (a typical phone keyboard takes ~40%)
    await p.waitForTimeout(300);
    const top1 = await p.$eval("#sheet", (e) => Math.round(e.getBoundingClientRect().top));
    check(Math.abs(top1 - top0) <= 1, "window stays where it was: " + top0 + " -> " + top1);
    for (const f of ["f-name", "f-phone", "f-price", "f-note"]) {
      const b = await p.$eval("#" + f, (e) => Math.round(e.getBoundingClientRect().bottom));
      check(b < 500, f + " stays above the keyboard: bottom " + b);
    }
    check(top0 < 140, "the booking window opens high: top " + top0);
    await p.keyboard.type("Klaviatura");
    await p.setViewportSize({ width: 412, height: 860 });   // keyboard closes
    await p.waitForTimeout(300);
    const top2 = await p.$eval("#sheet", (e) => Math.round(e.getBoundingClientRect().top));
    check(Math.abs(top2 - top0) <= 1, "back in place after the keyboard closes: " + top2);
    check(await p.isVisible('[data-act="save-appt"]'), "«Yaz» visible again");
    check((await p.inputValue("#f-name")) === "Klaviatura", "typing kept");
    // other windows are not stuck at an old height
    await p.click('[data-act="close"]'); await p.click('[data-act="draft-drop"]').catch(() => {});
    await p.click("#cal >> text=Test Pasiyent"); await p.waitForTimeout(300);
    const st = await p.$eval("#sheet", (e) => e.style.height + "|" + e.style.marginBottom);
    check(st === "|", "a new window starts free: " + st);
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

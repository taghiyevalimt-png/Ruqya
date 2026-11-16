// iPhone: tapping a text field must not scroll the page (the window would jump); a scroll is undone at once.
const { open, check, AGENT } = require("../lib");
module.exports = async () => {
  const s = await open(AGENT, { viewport: { width: 390, height: 844 }, touch: true });
  try {
    const p = s.page;
    await p.waitForSelector("text=Test Pasiyent", { timeout: 15000 }); await p.waitForTimeout(3300);
    await p.tap("#fab"); await p.waitForTimeout(500);
    // make the page scrollable the way iPhone does when its keyboard opens
    await p.evaluate(() => { const d = document.createElement("div"); d.id = "kbspace"; d.style.height = "600px"; document.body.appendChild(d); });
    const top0 = await p.$eval("#sheet", (e) => Math.round(e.getBoundingClientRect().top));
    await p.tap("#f-name");
    check(await p.evaluate(() => document.activeElement && document.activeElement.id === "f-name"), "tap focuses the field");
    await p.evaluate(() => window.scrollTo(0, 160));   // what iPhone does on focus
    await p.waitForTimeout(80);
    const y = await p.evaluate(() => window.scrollY);
    check(y === 0, "page scroll undone at once: " + y);
    const top1 = await p.$eval("#sheet", (e) => Math.round(e.getBoundingClientRect().top));
    check(Math.abs(top1 - top0) <= 1, "window did not move: " + top0 + " -> " + top1);
    await p.keyboard.type("Ad");
    check((await p.inputValue("#f-name")) === "Ad", "typing works after the tap");
    // tapping the next field moves the focus there, still no scroll
    await p.tap("#f-phone");
    check(await p.evaluate(() => document.activeElement.id === "f-phone"), "second field focused");
    // with the window closed, the page may scroll normally
    await p.tap('[data-act="close"]'); await p.waitForTimeout(300);
    await p.evaluate(() => window.scrollTo(0, 100)); await p.waitForTimeout(80);
    check((await p.evaluate(() => window.scrollY)) > 0, "page scroll not blocked without a window");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

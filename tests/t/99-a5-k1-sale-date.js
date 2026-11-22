// A5-K1 (audit 5): «products added in Kassa later disappear». Cause found by running: the sale window took the day
// open in Kassa as the sale's date — a worker who had looked at another day saved today's sale into that day, and it
// was gone from today. Live data had 3 sales dated 2, 4 and 17 days after they were typed. Owner 22.11: a new sale is
// always dated today (it can still be changed by hand; a date that is not today is pointed out).
const { open, check, OWNER, seed, bakuToday } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  db.products = [{ id: "cccccccc-0000-4000-8000-000000000001", name: "Misvak", price: 3, archived: false, sort: 1, created_at: now }];
  const s = await open(OWNER, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
    await p.click('#tabs [data-tab="cash"]'); await p.waitForTimeout(300);
    for (let i = 0; i < 3; i++) { await p.click('[data-act="shift"][data-n="-1"]'); await p.waitForTimeout(100); }   // the worker looks at 3 days ago
    await p.click('[data-act="new-prod"]'); await p.locator(".pbtn").first().waitFor();
    check(await p.inputValue("#sl-date") === bakuToday(), "the new sale's date is today, not the day looked at: " + await p.inputValue("#sl-date"));
    await p.click(".pbtn"); await p.click('[data-act="sell-save"]'); await p.waitForTimeout(500);
    const sale = s.db.product_sales[0];
    check(sale && sale.date === bakuToday(), "saved for today: " + JSON.stringify(sale && sale.date));
    check(/Misvak/.test(await p.textContent("#main")), "after saving, Kassa shows the day of the sale with the sale in it");
    // a date that is not today is pointed out before saving
    await p.click('[data-act="new-prod"]'); await p.locator("#sl-date").waitFor();
    await p.fill("#sl-date", bakuToday(-5)); await p.click(".pbtn"); await p.waitForTimeout(100);
    check(/bu gün deyil|не сегодня/i.test(await p.textContent("#sheet")), "a sale dated not today is pointed out");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

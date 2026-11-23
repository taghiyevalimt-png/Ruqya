// Owner 23.11 (photo of WhatsApp): a specialist copied «Məhsul satışları» and got «Əli (4, 35 ₼): 11 ₼» — numbers without
// their names. A short table with numbers now says what every number is: «Əli: Satış 4 · Məbləğ 35 ₼ · Payı 11 ₼»; the
// same for «Məhsullar üzrə». «Kim neçə seans yazıb» (role in brackets) stays as it was.
const { open, check, SPEC, AGENT, seed, bakuToday, uuid } = require("../lib");
module.exports = async () => {
  const db = seed(), t = bakuToday(), now = new Date().toISOString(), P = "cccccccc-0000-4000-8000-0000000000c1";
  db.products = [{ id: P, name: "Ruqyalı gül suyu", price: 8.75, archived: false, sort: 1, created_at: now }];
  db.product_shares = [{ product_id: P, staff_id: SPEC, pct: null, amt: 2.75 }];
  db.product_sales = [{ id: uuid(), date: t, product_id: P, qty: 4, price: 8.75, amount: 35, names: "Ruqyalı gül suyu", created_by: SPEC, patient_of: SPEC, created_at: now }];
  const s = await open(SPEC, { db });
  try {
    const p = s.page; await p.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(300); await p.click('[data-act="st-per"][data-id="today"]'); await p.waitForTimeout(300);
    await p.click('[data-st^="prod-"] [data-act="st-copy-t"]'); await p.waitForTimeout(300);
    const a = await p.evaluate(() => navigator.clipboard.readText());
    // since 23.11 late evening every copy is plain: «Əli - 4 satış, ümumi 35 manat, payı 11 manat»
    check(a.replace(/\u00a0|\u202f/g, " ").split("\n").includes("Əli - 4 satış, ümumi 35 manat, payı 11 manat"), "every number named: " + JSON.stringify(a));
    check(!/\(4, 35/.test(a), "no unnamed numbers in brackets");
    await p.click('[data-st^="prodp-"] [data-act="st-copy-t"]'); await p.waitForTimeout(300);
    const b = await p.evaluate(() => navigator.clipboard.readText());
    check(b.split("\n").includes("Ruqyalı gül suyu - 4 ədəd, məbləğ 35 manat") && !/[*▪🔸📊₼]/u.test(b), "per product, plain: " + JSON.stringify(b));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

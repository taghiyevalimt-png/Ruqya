// Owner 23.11: when a specialist copies «Məhsul satışları» for WhatsApp, the text also says which products were sold,
// how many, the price of each, and at the end the total, what stays with the centre and what with him. The screen is
// unchanged. Here: Əli sold 2 × Ruqyalı su (2 ₼) himself; Nurlana sold 1 × Yağ (25 ₼, Əli gets 18 ₼) to Əli's patient.
const { open, check, SPEC, AGENT, OWNER, seed, bakuToday, uuid } = require("../lib");
module.exports = async () => {
  const db = seed(), t = bakuToday(), now = new Date().toISOString(), P1 = "cccccccc-0000-4000-8000-0000000000e1", P2 = "cccccccc-0000-4000-8000-0000000000e2";
  db.products = [{ id: P1, name: "Ruqyalı su", price: 2, archived: false, sort: 1, created_at: now }, { id: P2, name: "Yağ", price: 25, archived: false, sort: 2, created_at: now }];
  db.product_shares = [{ product_id: P2, staff_id: SPEC, pct: null, amt: 18 }, { product_id: P1, staff_id: SPEC, pct: 10, amt: null }];
  db.product_sales = [
    { id: uuid(), date: t, product_id: P1, qty: 2, price: 2, amount: 4, names: "Ruqyalı su", created_by: SPEC, patient_of: SPEC, created_at: now },
    { id: uuid(), date: t, product_id: P2, qty: 1, price: 25, amount: 25, names: "Yağ", created_by: AGENT, patient_of: SPEC, created_at: now },
  ];
  const nb = (x) => x.replace(/ | /g, " ");
  let s = await open(SPEC, { db });
  try {
    const p = s.page; await p.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(300); await p.click('[data-act="st-per"][data-id="today"]'); await p.waitForTimeout(300);
    const screen = await p.textContent('[data-st^="prod-"] table');
    await p.click('[data-st^="prod-"] [data-act="st-copy-t"]'); await p.waitForTimeout(300);
    const a = nb(await p.evaluate(() => navigator.clipboard.readText()));
    check(/▪️ \*Əli\*: Satış 2 · Məbləğ 4 ₼ · Payı \*0,4 ₼\*/.test(a) && /▪️ \*Nurlana\*: Satış 1 · Məbləğ 25 ₼ · Payı \*18 ₼\*/.test(a), "the table part as before: " + JSON.stringify(a));
    check(/📦 \*Satılan məhsullar\*/.test(a) && /▪️ Ruqyalı su — 2 əd\. × 2 ₼ = \*4 ₼\*/.test(a) && /▪️ Yağ — 1 əd\. × 25 ₼ = \*25 ₼\* \(satdı: Nurlana\)/.test(a), "each product, how many, its price (and who sold it to his patient): " + JSON.stringify(a));
    check(/💰 \*Cəmi: 29 ₼\*/.test(a) && /👤 Sizə: \*18,4 ₼\*/.test(a) && /🏢 Mərkəzə: \*10,6 ₼\*/.test(a), "total 29, his 18,4, the centre 10,6: " + JSON.stringify(a));
    check(screen === await p.textContent('[data-st^="prod-"] table') && !/Satılan məhsullar/.test(await p.textContent("#main")), "the screen is unchanged");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
  // the admin's copy: products, total, what goes to the sellers and specialists, what stays with the centre
  s = await open(OWNER, { db });
  try {
    const p = s.page; await p.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await p.click('#tabs [data-tab="stats"]'); await p.click('#top [data-act="st-sec"][data-id="prod"]'); await p.waitForTimeout(200); await p.click('[data-act="st-per"][data-id="today"]'); await p.waitForTimeout(300);
    await p.click('[data-st^="prod-"] [data-act="st-copy-t"]'); await p.waitForTimeout(300);
    const b = nb(await p.evaluate(() => navigator.clipboard.readText()));
    check(/▪️ Ruqyalı su — 2 əd\. × 2 ₼ = \*4 ₼\*/.test(b) && /💰 \*Cəmi: 29 ₼\*/.test(b) && /👥 Satıcılara və mütəxəssislərə: \*18,4 ₼\*/.test(b) && /🏢 Mərkəzə: \*10,6 ₼\*/.test(b), "admin: products, total, parts, centre: " + JSON.stringify(b));
    check(!s.errors.length, "no page errors (admin): " + s.errors.join("; "));
  } finally { await s.close(); }
};

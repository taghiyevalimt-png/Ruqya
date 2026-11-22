// Owner 22.11: «the admin adds products; each is a button with its name and price; one tap = one sale, two taps = two;
// the total is shown at the end; specialists sell too and see only their own sales, agents and admins see all».
const { open, check, OWNER, AGENT, SPEC, seed, bakuToday, uuid } = require("../lib");
module.exports = async () => {
  const db = seed(), t = bakuToday(), now = new Date().toISOString();
  let s = await open(OWNER, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await p.click('#tabs [data-tab="cash"]'); await p.waitForTimeout(300);
    await p.click('[data-act="catalog"]'); await p.locator("#c-name").waitFor();
    for (const [n, pr] of [["Zeytun yağı", "15"], ["Misvak", "3,5"]]) { await p.fill("#c-name", n); await p.fill("#c-price", pr); await p.click('[data-act="cat-save"]'); await p.waitForTimeout(300); }
    check(s.db.products.length === 2 && s.db.products[1].price === 3.5, "the admin added two products: " + JSON.stringify(s.db.products.map((x) => [x.name, x.price])));
    await p.click('[data-act="close"]'); await p.waitForTimeout(300);
    await p.click('[data-act="new-prod"]'); await p.locator(".pbtn").first().waitFor();
    const btn = await p.evaluate(() => [...document.querySelectorAll(".pbtn")].map((b) => b.textContent));
    check(btn.length === 2 && /Zeytun yağı/.test(btn[0]) && /15/.test(btn[0]), "buttons show name and price: " + btn);
    await p.click('.pbtn:has-text("Zeytun")'); await p.click('.pbtn:has-text("Zeytun")'); await p.click('.pbtn:has-text("Misvak")');
    check(/33[.,]5/.test(await p.textContent(".ptotal")), "the total: 2 × 15 + 3,5 = 33,5: " + await p.textContent(".ptotal"));
    await p.click('[data-act="sell-sub"]'); await p.waitForTimeout(100);
    check(/18[.,]5/.test(await p.textContent(".ptotal")), "«−» takes one back: " + await p.textContent(".ptotal"));
    await p.click('.pbtn:has-text("Zeytun")'); await p.click('[data-act="sell-save"]'); await p.waitForTimeout(500);
    const sales = s.db.product_sales.map((x) => [x.names, x.qty, x.amount]).sort();
    check(JSON.stringify(sales) === JSON.stringify([["Misvak", 1, 3.5], ["Zeytun yağı", 2, 30]]), "saved one line per product: " + JSON.stringify(sales));
    check(/33[.,]5/.test(await p.textContent(".pay .ptotal")), "the day's total in Kassa: " + await p.textContent(".pay .ptotal"));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
  // the specialist: has Kassa (no expenses), sells, sees only his own
  db.product_sales.push({ id: uuid(), date: t, amount: 99, names: "Başqasının satışı", created_by: AGENT, created_at: now, product_id: null, qty: 1, price: 99 });
  s = await open(SPEC, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    check(await p.locator('#tabs [data-tab="cash"]:not([hidden])').count() === 1, "the specialist has Kassa");
    await p.click('#tabs [data-tab="cash"]'); await p.waitForTimeout(300);
    check(!/Xərclər/.test(await p.textContent("#main")), "no expenses for him");
    check(!/Başqasının|Zeytun/.test(await p.textContent("#main")), "he does not see other people's sales");
    await p.click('[data-act="new-prod"]'); await p.click('.pbtn:has-text("Misvak")'); await p.click('[data-act="sell-save"]'); await p.waitForTimeout(500);
    const mine = s.db.product_sales.filter((x) => x.created_by === SPEC);
    check(mine.length === 1 && mine[0].names === "Misvak", "his sale is saved under his name");
    check(/Misvak/.test(await p.textContent("#main")) && !/Zeytun/.test(await p.textContent("#main")), "he sees his own sale only");
    check(!s.errors.length, "specialist: no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
  // the agent sees all of them
  s = await open(AGENT, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await p.click('#tabs [data-tab="cash"]'); await p.waitForTimeout(300);
    const txt = await p.textContent("#main");
    check(/Zeytun/.test(txt) && /Misvak/.test(txt) && /Başqasının/.test(txt), "the agent sees everybody's sales");
    check(!s.errors.length, "agent: no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

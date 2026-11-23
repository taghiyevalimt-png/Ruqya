// Owner 23.11: «if sales agents sell products from which a specialist gets something, the specialist must see that sale
// in full in Kassa, in his statistics what concerns his product, and which agent sold it». A specialist's share in a
// product = his part of every sale of it, whoever sells; an agent's share = his part of his own sales only.
const { open, check, OWNER, AGENT, SPEC, seed, bakuToday, uuid } = require("../lib");
module.exports = async () => {
  const db = seed(), t = bakuToday(), now = new Date().toISOString();
  const P1 = "cccccccc-0000-4000-8000-0000000000a1", P2 = "cccccccc-0000-4000-8000-0000000000a2";
  db.products = [{ id: P1, name: "Əli yağı", price: 25, archived: false, sort: 1, created_at: now }, { id: P2, name: "Misvak", price: 10, archived: false, sort: 2, created_at: now }];
  db.product_shares = [{ product_id: P1, staff_id: SPEC, pct: null, amt: 18 }, { product_id: P2, staff_id: AGENT, pct: 10, amt: null }];
  db.product_sales = [
    { id: uuid(), date: t, product_id: P1, qty: 2, price: 25, amount: 50, names: "Əli yağı", created_by: AGENT, created_at: now },
    { id: uuid(), date: t, product_id: P2, qty: 1, price: 10, amount: 10, names: "Misvak", created_by: AGENT, created_at: now },
    { id: uuid(), date: t, product_id: P1, qty: 1, price: 25, amount: 25, names: "Əli yağı", created_by: SPEC, created_at: now },
  ];
  const txt = (p, q) => p.evaluate((sel) => { const e = document.querySelector(sel); return e ? e.textContent.replace(/\s+/g, " ").trim() : ""; }, q);
  const rows = (p, q) => p.evaluate((sel) => [...document.querySelectorAll(sel + " tbody tr, " + sel + " tfoot tr")].map((r) => [...r.children].map((c) => c.textContent.replace(/\s+/g, " ").trim()).join("|")), q);
  const toProd = async (p) => { await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(300);
    if (await p.locator('#top [data-act="st-sec"][data-id="prod"]').count()) await p.click('#top [data-act="st-sec"][data-id="prod"]');
    await p.waitForTimeout(200); await p.click('[data-act="st-per"][data-id="today"]'); await p.waitForTimeout(300); };

  // the specialist (Əli)
  let s = await open(SPEC, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await p.click('#tabs [data-tab="cash"]'); await p.waitForTimeout(400);
    const sales = await p.evaluate(() => [...document.querySelectorAll(".psale")].map((e) => e.textContent.replace(/\s+/g, " ").trim()));
    check(sales.length === 2 && sales.every((x) => /Əli yağı/.test(x)) && !sales.some((x) => /Misvak/.test(x)), "Kassa: both sales of HIS product, not the other product: " + JSON.stringify(sales));
    const ag = sales.find((x) => /Nurlana/.test(x)) || "";
    check(/× 2/.test(ag) && /50/.test(ag) && /Satdı: Nurlana/.test(ag) && /Sizə: 36/.test(ag), "the agent's sale in full: product, ×2, 50 ₼, who sold, your part 36 ₼: " + ag);
    check(!/Dəyiş|Sil/.test(ag), "the agent's sale cannot be changed by the specialist: " + ag);
    check(/Sizin payınız\s*54/.test(await txt(p, ".pay")), "your part today: 18 (own sale) + 36 (agent's) = 54: " + await txt(p, ".ptotal.mine"));
    await toProd(p);
    const r1 = await rows(p, '[data-st^="prod-"]');
    check(r1.some((x) => /^Əli\|1\|25.*\|18/.test(x)) && r1.some((x) => /^Nurlana\|2\|50.*\|36/.test(x)) && r1.some((x) => /^Cəmi\|3\|75.*\|54/.test(x)), "statistics: who sold how much of his product and his part of each: " + JSON.stringify(r1));
    check(!r1.some((x) => /Misvak|^Nurlana\|3/.test(x)), "the other product is not there: " + JSON.stringify(r1));
    check(!s.errors.length, "no page errors (specialist): " + s.errors.join("; "));
  } finally { await s.close(); }

  // the agent: his own sales, his commission only from his own product share (Misvak 10 % = 1 ₼)
  s = await open(AGENT, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await toProd(p);
    const r2 = await rows(p, '[data-st^="prod-"]');
    check(r2.some((x) => /^Nurlana\|3\|60.*\|1/.test(x)) && !r2.some((x) => /^Əli/.test(x)), "agent: own 3 pieces, 60 ₼, part 1 ₼ (none from Əli's product): " + JSON.stringify(r2));
    check(!s.errors.length, "no page errors (agent): " + s.errors.join("; "));
  } finally { await s.close(); }

  // the admin: each person's part — Əli 18 + 36 = 54 (also from the agent's sales), Nurlana 1; total 55
  s = await open(OWNER, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await toProd(p);
    const r3 = await rows(p, '[data-st^="prod-"]');
    check(r3.some((x) => /^Əli\|1\|25.*\|54/.test(x)) && r3.some((x) => /^Nurlana\|3\|60.*\|1/.test(x)) && r3.some((x) => /^Cəmi\|4\|85.*\|55/.test(x)), "admin: parts per person: " + JSON.stringify(r3));
    await p.click('#tabs [data-tab="cash"]'); await p.click('[data-act="catalog"]'); await p.waitForTimeout(300);
    check(/Kimə nə qalır/.test(await txt(p, "#sheet")) && /hər satışından, kim satsa da/.test(await txt(p, "#sheet")), "the catalog says who gets what");
    check(!s.errors.length, "no page errors (admin): " + s.errors.join("; "));
  } finally { await s.close(); }
};

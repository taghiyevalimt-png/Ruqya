// Owner 22.11: «for every product a percent for every specialist (and sales agent): Ruqyalı sirkə, Loğman 50% — his
// statistics show the 10 ₼ that stays with him. Every specialist and agent sees only what concerns himself».
const { open, check, OWNER, AGENT, SPEC, seed, bakuToday, uuid } = require("../lib");
module.exports = async () => {
  const db = seed(), t = bakuToday(), now = new Date().toISOString(), PID = "cccccccc-0000-4000-8000-000000000009";
  db.products = [{ id: PID, name: "Ruqyalı sirkə", price: 20, archived: false, sort: 1, created_at: now }];
  db.product_sales = [
    { id: uuid(), date: t, product_id: PID, qty: 1, price: 20, amount: 20, names: "Ruqyalı sirkə", created_by: SPEC, created_at: now },
    { id: uuid(), date: t, product_id: PID, qty: 2, price: 20, amount: 40, names: "Ruqyalı sirkə", created_by: AGENT, created_at: now },
  ];
  let s = await open(OWNER, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await p.click('#tabs [data-tab="cash"]'); await p.click('[data-act="catalog"]'); await p.click('[data-act="cat-edit"]'); await p.locator("#c-pct-" + SPEC).waitFor();
    await p.fill("#c-pct-" + SPEC, "50"); await p.fill("#c-pct-" + AGENT, "10");
    check(/10/.test(await p.textContent('[data-pv="' + SPEC + '"]')), "the part is shown while typing: 50% of 20 = 10");
    await p.click('[data-act="cat-save"]'); await p.waitForTimeout(500);
    const sh = s.db.product_shares.map((x) => x.staff_id.slice(0, 4) + "=" + x.pct).sort().join(",");
    check(sh === "1111=10,2222=50", "saved: Əli 50%, Nurlana 10%: " + sh);
    await p.click('[data-act="close"]'); await p.click('#tabs [data-tab="stats"]'); await p.click('#top [data-act="st-sec"][data-id="prod"]'); await p.waitForTimeout(300);
    const rows = await p.evaluate(() => [...document.querySelectorAll(".pay")].filter((x) => /Satanlar/.test(x.textContent)).map((x) => [...x.querySelectorAll("tbody tr")].map((r) => [...r.children].map((c) => c.textContent.trim()).join("|")))[0]);
    check(rows.some((r) => /^Əli\|1\|20.*\|10/.test(r)) && rows.some((r) => /^Nurlana\|2\|40.*\|4/.test(r)), "admin: every seller's part: " + JSON.stringify(rows));
    // changing back to empty deletes the percent
    await p.click('#tabs [data-tab="cash"]'); await p.click('[data-act="catalog"]'); await p.click('[data-act="cat-edit"]'); await p.locator("#c-pct-" + AGENT).waitFor();
    await p.fill("#c-pct-" + AGENT, ""); await p.click('[data-act="cat-save"]'); await p.waitForTimeout(500);
    check(s.db.product_shares.length === 1, "an emptied percent is removed");
    await p.click('[data-act="cat-edit"]'); await p.fill("#c-pct-" + AGENT, "10"); await p.click('[data-act="cat-save"]'); await p.waitForTimeout(500);
    // a new product gets its percents in the same form
    await p.fill("#c-name", "Bal"); await p.fill("#c-price", "10"); await p.fill("#c-pct-" + SPEC, "30");
    await p.click('[data-act="cat-save"]'); await p.waitForTimeout(700);
    const bal = s.db.products.find((x) => x.name === "Bal"), bs = bal && s.db.product_shares.find((x) => x.product_id === bal.id);
    check(bs && bs.staff_id === SPEC && bs.pct === 30, "a new product saved with its percent: " + JSON.stringify(bs));
    check(!s.errors.length, "admin: no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
  // the server gives everybody only his own percents (row security); the fake database does the same here
  const own = (id) => { const d = JSON.parse(JSON.stringify(db)); d.product_shares = d.product_shares.filter((x) => x.staff_id === id); d.product_sales = id === SPEC ? d.product_sales.filter((x) => x.created_by === SPEC) : d.product_sales; return d; };
  for (const [who, name, mine, other] of [[SPEC, "Əli", "10", "Nurlana"], [AGENT, "Nurlana", "4", "Əli"]]) {
    s = await open(who, { db: own(who) });
    try {
      const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
      check(await p.locator('#tabs [data-tab="stats"]:not([hidden])').count() === 1, name + ": has Statistika");
      await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(400);
      if (who === SPEC) check(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('[data-act="st-sec"]')].map((b) => b.dataset.id))) === '["prod"]', "the specialist sees only «Məhsul»: " + JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('[data-act="st-sec"]')].map((b) => b.dataset.id))));
      await p.click('#top [data-act="st-sec"][data-id="prod"]'); await p.waitForTimeout(300);
      const txt = await p.textContent("#main");
      check(new RegExp("Sizin payınız").test(txt) && new RegExp(mine + "[,.]?0* ?₼[\\s\\S]*Sizin payınız").test(await p.textContent(".todaysum")), name + ": his own part " + mine + ": " + (await p.textContent(".todaysum")));
      check(!txt.includes(other) && !/Satanlar üzrə/.test(txt), name + ": nobody else's sales or part");
      check(!s.errors.length, name + ": no page errors: " + s.errors.join("; "));
    } finally { await s.close(); }
  }
};

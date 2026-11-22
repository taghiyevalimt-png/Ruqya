// A5-K1 acceptance: 300 sales tapped together in Kassa at different speeds, with server errors and broken connections
// at random moments, double taps on «Yadda saxla», page reloads and a second worker selling at the same time —
// 0 lost sales, 0 lost or changed names, 0 duplicates; every sale in the database equals what the worker saw (date,
// pieces, amount). A failed save never vanishes: the window comes back with the same taps and is saved again.
const { open, check, OWNER, AGENT, seed, bakuToday } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString(), T = bakuToday();
  const names = ["Zeytun yağı, 1 litr", 'Bal "Dağ"', "Misvak 🌿", "Qara zirə; 250 ml", "Мёд горный", "Ç".repeat(60)];
  db.products = names.map((n, i) => ({ id: "cccccccc-0000-4000-8000-00000000000" + (i + 1), name: n, price: 2.5 * (i + 1), archived: false, sort: i, created_at: now }));
  let rnd = 12345; const R = () => (rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648;
  const want = [];   // [name, qty, amount, by]
  const s = await open(OWNER, { db }), s2 = await open(AGENT, { db });
  try {
    const p = s.page, q = s2.page;
    for (const x of [p, q]) { await x.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await x.waitForTimeout(2500); await x.click('#tabs [data-tab="cash"]'); await x.waitForTimeout(200); }
    const sell = async (pg, ctl, by, mode) => {
      await pg.click('[data-act="new-prod"]'); await pg.locator("#sheet .pbtn").first().waitFor();
      const taps = {}; const n = 1 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) { const i = Math.floor(R() * names.length); await pg.locator("#sheet .pbtn").nth(i).click({ delay: R() < .5 ? 0 : 30 }); taps[i] = (taps[i] || 0) + 1; }
      if (mode === "500") ctl.failWrite = { status: 500, body: { message: "boom" } };
      if (mode === "net") ctl.failWrite = "net";
      if (mode === "double") { await pg.evaluate(() => { const b = document.querySelector('[data-act="sell-save"]'); b.click(); b.click(); }); }
      else await pg.click('[data-act="sell-save"]');
      if (mode === "500" || mode === "net") {
        // the window must come back with the same taps; the worker saves again
        await pg.locator('#sheet [data-act="sell-save"]').waitFor({ timeout: 12000 });
        const back = await pg.evaluate(() => [...document.querySelectorAll("#sheet .pbtn i")].map((x) => +x.textContent).reduce((a, b) => a + b, 0));
        check(back === n, "after a failed save the window is back with the same " + n + " pieces: " + back);
        if (mode === "net") { await pg.waitForTimeout(200); }
        await pg.click('[data-act="sell-save"]');
      }
      Object.keys(taps).forEach((i) => want.push([names[i], taps[i], Math.round(taps[i] * 2.5 * (+i + 1) * 100) / 100, by]));
      await pg.waitForTimeout(mode === "fast" ? 0 : 60);
    };
    for (let it = 0; it < 300; it++) {
      const r = R(), mode = r < .08 ? "500" : r < .14 ? "net" : r < .22 ? "double" : r < .5 ? "fast" : "normal";
      if (it % 10 === 9) await sell(q, s2.ctl, AGENT, "normal");     // the second worker at the same time
      else await sell(p, s.ctl, OWNER, mode);
      if (it % 75 === 74) { await p.waitForTimeout(800); await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2600); await p.click('#tabs [data-tab="cash"]'); await p.waitForTimeout(200); }
    }
    await p.waitForTimeout(1500);
    const got = db.product_sales.map((x) => [x.names, x.qty, x.amount, x.created_by]);
    const key = (x) => x.join("|"), cnt = (a) => a.reduce((m, x) => { m[key(x)] = (m[key(x)] || 0) + 1; return m; }, {});
    const W = cnt(want), G = cnt(got), lost = [], extra = [];
    Object.keys(W).forEach((k) => { if ((G[k] || 0) < W[k]) lost.push(k + " ×" + (W[k] - (G[k] || 0))); });
    Object.keys(G).forEach((k) => { if ((W[k] || 0) < G[k]) extra.push(k + " ×" + (G[k] - (W[k] || 0))); });
    require("fs").mkdirSync(require("path").join(__dirname, "..", "out"), { recursive: true }); require("fs").writeFileSync(require("path").join(__dirname, "..", "out", "a5-k1-chaos.json"), JSON.stringify({ sales: want.length, rows: got.length, lost, extra }, null, 1));
    check(!lost.length, "0 lost sales / names: " + lost.slice(0, 5).join("; "));
    check(!extra.length, "0 duplicates: " + extra.slice(0, 5).join("; "));
    check(db.product_sales.every((x) => x.date === T), "every sale dated today");
    check(db.product_sales.every((x) => names.includes(x.names)), "every name exactly as the product (commas, quotes, emoji, 60 letters)");
    // the first worker sees every sale of the day (his and the second worker's) after a reload
    await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2600); await p.click('#tabs [data-tab="cash"]'); await p.waitForTimeout(300);
    const shown = await p.locator(".psale").count();
    check(shown === db.product_sales.length, "Kassa shows every line of the day: " + shown + " of " + db.product_sales.length);
    check(!s.errors.length && !s2.errors.length, "no page errors: " + s.errors.concat(s2.errors).join("; "));
  } finally { await s.close(); await s2.close(); }
};

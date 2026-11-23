// 23.11 (second bug hunt): markup in names never runs on the screens added today — Kassa sales with «Pasiyent: …»,
// the sell form with «Əsas məhsullar» and the agent's «Kimin pasiyentidir?» buttons, product statistics per person,
// the presets sheet. CSP is switched off, so the escaping itself is tested (20-xss.js covers the older screens).
const { open, check, OWNER, AGENT, SPEC, seed, bakuToday, uuid } = require("../lib");
const X = [`<img src=x onerror="window.__xss=1">`, `"><svg onload=window.__xss=2>`, `'><script>window.__xss=3</script>`];
module.exports = async () => {
  const db = seed(), t = bakuToday(), now = new Date().toISOString();
  const P1 = "cccccccc-0000-4000-8000-0000000000c1", P2 = "cccccccc-0000-4000-8000-0000000000c2";
  db.staff.forEach((s) => { if (s.id === SPEC) s.name = X[0]; if (s.id === AGENT) s.name = X[1]; });
  db.products = [{ id: P1, name: "Ruqyalı su " + X[2], price: 5, archived: false, sort: 1, created_at: now },
    { id: P2, name: X[0], price: 10, archived: false, sort: 2, created_at: now }];
  db.product_shares = [{ product_id: P1, staff_id: SPEC, pct: null, amt: 1 }, { product_id: P2, staff_id: AGENT, pct: 10, amt: null }];
  const sale = (by, pid, price, pat) => ({ id: uuid(), date: t, product_id: pid, qty: 2, price, amount: 2 * price, names: X[1], created_by: by, patient_of: pat, created_at: now });
  db.product_sales = [sale(AGENT, P1, 5, SPEC), sale(AGENT, P2, 10, null), sale(SPEC, P1, 5, SPEC), sale(OWNER, P2, 10, null)];
  const verify = async (s, who) => {
    const r = await s.page.evaluate(() => ({ xss: window.__xss, imgs: document.querySelectorAll('img[src="x"]').length, svg: document.querySelectorAll("svg[onload]").length, scripts: [...document.querySelectorAll("script")].filter((x) => /__xss/.test(x.textContent)).length }));
    check(r.xss === undefined && !r.imgs && !r.svg && !r.scripts, who + ": no injected markup ran or became an element: " + JSON.stringify(r));
    check(!s.errors.length, who + ": no page errors: " + s.errors.join("; "));
  };
  const visit = async (p, admin) => {
    await p.click('#tabs [data-tab="cash"]'); await p.waitForTimeout(400);
    { const k = await p.textContent("#main"); check(/svg onload/.test(k), "the payload is shown as text in Kassa: " + k.slice(0, 600)); }
    await p.click('[data-act="new-prod"]'); await p.locator("#sheet .pbtn").first().waitFor(); await p.waitForTimeout(300);
    await p.click("#sheet .pbtn"); await p.waitForTimeout(200);
    await p.click('[data-act="close"]').catch(() => {}); await p.waitForTimeout(300);
    await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(300);
    if (await p.locator('#top [data-act="st-sec"][data-id="prod"]').count()) await p.click('#top [data-act="st-sec"][data-id="prod"]');
    for (const per of ["today", "week", "month"]) { await p.click('[data-act="st-per"][data-id="' + per + '"]').catch(() => {}); await p.waitForTimeout(250); }
    if (admin) { await p.click('#tabs [data-tab="readers"]'); await p.waitForTimeout(200); await p.click('[data-act="presets"]').catch(() => {}); await p.waitForTimeout(400); await p.click('[data-act="close"]').catch(() => {}); }
  };
  for (const [who, admin] of [[OWNER, true], [AGENT, false], [SPEC, false]]) {
    const s = await open(who, { db, bypassCSP: true });
    try {
      const p = s.page; let dialogs = 0; p.on("dialog", (d) => { dialogs++; d.dismiss().catch(() => {}); });
      await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
      await visit(p, admin);
      check(!dialogs, who + ": no dialogs opened");
      await verify(s, who);
    } finally { await s.close(); }
  }
};

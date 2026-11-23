// Owner 23.11 (late evening): «the stars and the rest confuse — it must be this simple:
// Loğman - 4 satış, ümumi 63 manat, payı 17 manat». Plain text, one line per person, no products, no
// totals, no stars or emoji; people with nothing are left out. The screen is unchanged.
const { open, check, SPEC, AGENT, OWNER, seed, bakuToday, uuid } = require("../lib");
const SPEC2 = "33333333-3333-4333-8333-333333333333";
module.exports = async () => {
  const db = seed(), t = bakuToday(), now = new Date().toISOString();
  const P = { su: "cccccccc-0000-4000-8000-0000000000e1", zy: "cccccccc-0000-4000-8000-0000000000e2", yag: "cccccccc-0000-4000-8000-0000000000e3" };
  db.staff.push({ id: SPEC2, name: "Loğman", role: "specialist", want: null, created_at: now, hide_stats: false });
  db.products = [{ id: P.su, name: "Ruqyalı su", price: 2, archived: false, sort: 1, created_at: now }, { id: P.zy, name: "Ruqyalı zeytun yağı", price: 18, archived: false, sort: 2, created_at: now }, { id: P.yag, name: "Yağ", price: 25, archived: false, sort: 3, created_at: now }];
  db.product_shares = [{ product_id: P.yag, staff_id: SPEC, pct: null, amt: 18 }, { product_id: P.su, staff_id: SPEC, pct: 10, amt: null }];
  const sale = (by, pid, qty, price, pat) => ({ id: uuid(), date: t, product_id: pid, qty, price, amount: qty * price, names: "", created_by: by, patient_of: pat, created_at: now });
  db.product_sales = [sale(SPEC, P.su, 2, 2, SPEC), sale(AGENT, P.yag, 1, 25, SPEC), sale(AGENT, P.zy, 3, 18, null), sale(SPEC2, P.zy, 2, 18, SPEC2), sale(SPEC2, P.su, 1, 2, SPEC2)];
  const nb = (x) => x.replace(/ | /g, " ");
  const copy = async (who) => {
    const s = await open(who, { db });
    try {
      const p = s.page; await p.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
      await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(300);
      if (await p.locator('#top [data-act="st-sec"][data-id="prod"]').count()) await p.click('#top [data-act="st-sec"][data-id="prod"]');
      await p.waitForTimeout(200); await p.click('[data-act="st-per"][data-id="today"]'); await p.waitForTimeout(300);
      const screen = await p.textContent('[data-st^="prod-"] table');
      await p.click('[data-st^="prod-"] [data-act="st-copy-t"]'); await p.waitForTimeout(300);
      const txt = nb(await p.evaluate(() => navigator.clipboard.readText()));
      check(screen === await p.textContent('[data-st^="prod-"] table') && !/Satılan|×/.test(await p.textContent("#main")), "the screen is unchanged");
      check(!s.errors.length, "no page errors: " + s.errors.join("; "));
      return txt;
    } finally { await s.close(); }
  };
  // the admin
  const a = await copy(OWNER);
  require("fs").writeFileSync(require("path").join(__dirname, "..", "out", "wa-products-admin.txt"), a);
  const lines = a.split("\n");
  check(/^Məhsul satışları, \S/.test(a) && !/[*_👤📊▪️💰🏢₼]/u.test(a), "plain text, no stars, emoji or ₼: " + JSON.stringify(a));
  check(lines.includes("Loğman - 3 satış, ümumi 38 manat, payı 0 manat"), "Loğman: " + JSON.stringify(a));
  check(lines.includes("Nurlana - 4 satış, ümumi 79 manat, payı 0 manat"), "Nurlana: " + JSON.stringify(a));
  check(lines.includes("Əli - 2 satış, ümumi 4 manat, payı 18,4 manat"), "Əli (with his part of the agent's sale to his patient): " + JSON.stringify(a));
  check(lines.filter((x) => / - \d+ satış/.test(x)).length === 3 && !/Admin|×|Cəmi|Mərkəzə|Keçici/.test(a), "only the people's lines: " + JSON.stringify(a));
  const b = await copy(SPEC), lb = b.split("\n");
  check(lb.includes("Əli - 2 satış, ümumi 4 manat, payı 0,4 manat") && lb.includes("Nurlana - 1 satış, ümumi 25 manat, payı 18 manat") && lb.filter((x) => / - \d+ satış/.test(x)).length === 2 && !/Loğman|Cəmi|\*/.test(b), "specialist: " + JSON.stringify(b));
};

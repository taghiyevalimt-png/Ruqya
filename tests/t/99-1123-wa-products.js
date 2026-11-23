// Owner 23.11: the WhatsApp copy of «Məhsul satışları» must show, for every person, which products he sold, how many,
// at which price — then his sum and part; people with nothing are left out; at the end the total, what goes to the
// sellers and specialists (or «Sizə» for the one copying) and what stays with the centre. The screen is unchanged.
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
  const block = (name) => { const i = a.indexOf("👤 *" + name + "*"); if (i < 0) return ""; const j = a.indexOf("\n\n", i); return a.slice(i, j < 0 ? undefined : j); };
  check(/^📊 \*Məhsul satışları\*\n_/.test(a), "title and day");
  const ln = block("Loğman"), nu = block("Nurlana"), al = block("Əli");
  check(/— 3 əd\., 38 ₼/.test(ln) && /▪️ Ruqyalı zeytun yağı — 2 × 18 ₼ = 36 ₼/.test(ln) && /▪️ Ruqyalı su — 1 × 2 ₼ = 2 ₼/.test(ln), "Loğman: which products, how many, price: " + JSON.stringify(ln));
  check(/— 4 əd\., 79 ₼/.test(nu) && /▪️ Yağ — 1 × 25 ₼ = 25 ₼ \(pasiyent: Əli\)/.test(nu) && /▪️ Ruqyalı zeytun yağı — 3 × 18 ₼ = 54 ₼ \(Keçici\)/.test(nu), "Nurlana: products, whose patient or passer-by: " + JSON.stringify(nu));
  check(/— 2 əd\., 4 ₼ · Payı \*18,4 ₼\*/.test(al) && /▪️ Ruqyalı su — 2 × 2 ₼ = 4 ₼/.test(al), "Əli: his products and his part (with the agent's sale to his patient): " + JSON.stringify(al));
  check(!/Admin|Satış 0|0 əd\./.test(a), "people with nothing are left out: " + a);
  check(/💰 \*Cəmi: 9 əd\., 121 ₼\*/.test(a) && /👥 Satıcılara və mütəxəssislərə: \*18,4 ₼\*/.test(a) && /🏢 Mərkəzə: \*102,6 ₼\*/.test(a), "totals: " + JSON.stringify(a.slice(a.indexOf("💰"))));
  // the specialist Əli: himself and Nurlana's sale to his patient, his part, the centre
  const b = await copy(SPEC);
  check(/👤 \*Əli\* — 2 əd\., 4 ₼ · Payı \*0,4 ₼\*/.test(b) && /👤 \*Nurlana\* — 1 əd\., 25 ₼ · Payı \*18 ₼\*/.test(b) && /▪️ Yağ — 1 × 25 ₼ = 25 ₼/.test(b) && !/Loğman|Keçici|zeytun/.test(b), "specialist: his and the sales to his patients only: " + JSON.stringify(b));
  check(/💰 \*Cəmi: 3 əd\., 29 ₼\*/.test(b) && /👤 Sizə: \*18,4 ₼\*/.test(b) && /🏢 Mərkəzə: \*10,6 ₼\*/.test(b), "specialist totals: " + JSON.stringify(b.slice(b.indexOf("💰"))));
};

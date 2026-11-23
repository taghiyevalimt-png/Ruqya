// Owner 23.11: «from product A money may go to specialist B or C — it depends on whose patient it is. A specialist's own
// sale is his. A sales agent must press a button: the specialist whose patient it is, or a neutral one (a passer-by).
// A chosen specialist sees the sale in his statistics with the agent who sold; a neutral sale is only the agent's.
// Earlier agents' sales are neutral.»
const { open, check, OWNER, AGENT, SPEC, seed, bakuToday, uuid } = require("../lib");
const SPEC2 = "33333333-3333-4333-8333-333333333333";
module.exports = async () => {
  const db = seed(), t = bakuToday(), now = new Date().toISOString(), P1 = "cccccccc-0000-4000-8000-0000000000b1";
  db.staff.push({ id: SPEC2, name: "Günel", role: "specialist", want: null, created_at: now, hide_stats: false });
  db.products = [{ id: P1, name: "Yağ qarışımı", price: 25, archived: false, sort: 1, created_at: now }];
  db.product_shares = [{ product_id: P1, staff_id: SPEC, pct: null, amt: 18 }, { product_id: P1, staff_id: SPEC2, pct: null, amt: 15 }];
  const sale = (by, qty, pat) => ({ id: uuid(), date: t, product_id: P1, qty, price: 25, amount: 25 * qty, names: "Yağ qarışımı", created_by: by, patient_of: pat, created_at: now });
  db.product_sales = [sale(AGENT, 2, SPEC), sale(AGENT, 1, null), sale(AGENT, 3, SPEC2), sale(SPEC, 1, SPEC)];
  const rows = (p, q) => p.evaluate((sel) => [...document.querySelectorAll(sel + " tbody tr, " + sel + " tfoot tr")].map((r) => [...r.children].map((c) => c.textContent.replace(/\s+/g, " ").trim()).join("|")), q);
  const sales = (p) => p.evaluate(() => [...document.querySelectorAll(".psale")].map((e) => e.textContent.replace(/\s+/g, " ").trim()));
  const toProd = async (p) => { await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(300);
    if (await p.locator('#top [data-act="st-sec"][data-id="prod"]').count()) await p.click('#top [data-act="st-sec"][data-id="prod"]');
    await p.waitForTimeout(200); await p.click('[data-act="st-per"][data-id="today"]'); await p.waitForTimeout(300); };

  // the agent: the choice is required; the sale is saved with it; Kassa says whose patient
  let s = await open(AGENT, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await p.click('#tabs [data-tab="cash"]'); await p.waitForTimeout(300);
    const k0 = await sales(p);
    check(k0.some((x) => /× 2/.test(x) && /Pasiyent: Əli/.test(x)) && k0.some((x) => /Pasiyent: Keçici/.test(x)) && k0.some((x) => /× 3/.test(x) && /Pasiyent: Günel/.test(x)), "Kassa shows whose patient: " + JSON.stringify(k0));
    await p.click('[data-act="new-prod"]'); await p.locator("#sheet .pbtn").first().waitFor();
    const chips = await p.evaluate(() => [...document.querySelectorAll('[data-act="sell-pat"]')].map((b) => b.textContent.trim()));
    check(chips.length === 3 && chips.includes("Günel") && chips.includes("Əli") && chips[2] === "Keçici (heç kimin pasiyenti deyil)", "the agent picks a specialist or «Keçici» (last): " + chips);
    await p.click("#sheet .pbtn"); await p.click('[data-act="sell-save"]'); await p.waitForTimeout(300);
    check(/Kimin pasiyenti olduğunu seçin/.test(await p.textContent("#sl-err")), "not saved without the choice");
    const before = s.db.product_sales.length;
    await p.click('[data-act="sell-pat"][data-id="' + SPEC2 + '"]'); await p.click('[data-act="sell-save"]'); await p.waitForTimeout(700);
    const nw = s.db.product_sales.slice(before);
    check(nw.length === 1 && nw[0].patient_of === SPEC2, "saved for Günel's patient: " + JSON.stringify(nw.map((x) => x.patient_of)));
    // a neutral sale is stored as null
    await p.click('[data-act="new-prod"]'); await p.locator("#sheet .pbtn").first().waitFor(); await p.click("#sheet .pbtn");
    await p.click('[data-act="sell-pat"][data-id="-"]'); await p.click('[data-act="sell-save"]'); await p.waitForTimeout(700);
    const nn = s.db.product_sales[s.db.product_sales.length - 1];
    check(nn && nn.patient_of === null, "«Keçici» saved as nobody's: " + JSON.stringify(nn && nn.patient_of));
    // the agent's statistics: all his sales (neutral too)
    await toProd(p);
    const ra = await rows(p, '[data-st^="prod-"]');
    check(ra.some((x) => /^Nurlana\|8\|200/.test(x)), "the agent's statistics count all his sales (2+1+3+1+1): " + JSON.stringify(ra));
    check(!s.errors.length, "no page errors (agent): " + s.errors.join("; "));
  } finally { await s.close(); }
  db.product_sales = s.db.product_sales;

  // specialist Əli: his sale and the sale to his patient (with the agent's name), not the neutral one, not Günel's
  s = await open(SPEC, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await p.click('#tabs [data-tab="cash"]'); await p.waitForTimeout(400);
    const k1 = await sales(p);
    check(k1.length === 2 && k1.some((x) => /× 2/.test(x) && /Satdı: Nurlana/.test(x) && /Sizə: 36/.test(x)) && !k1.some((x) => /× 3/.test(x)), "Əli's Kassa: his sale + the agent's sale to his patient: " + JSON.stringify(k1));
    await toProd(p);
    const r1 = await rows(p, '[data-st^="prod-"]');
    check(r1.some((x) => /^Əli\|1\|25.*\|18/.test(x)) && r1.some((x) => /^Nurlana\|2\|50.*\|36/.test(x)) && r1.some((x) => /^Cəmi\|3\|75.*\|54/.test(x)), "Əli's statistics: who sold to his patients and his part: " + JSON.stringify(r1));
    check(!s.errors.length, "no page errors (Əli): " + s.errors.join("; "));
  } finally { await s.close(); }

  // specialist Günel: only the sales to her patients (3 + 1 pieces) with her part 15 ₼ a piece
  s = await open(SPEC2, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await toProd(p);
    const r2 = await rows(p, '[data-st^="prod-"]');
    check(r2.some((x) => /^Nurlana\|4\|100.*\|60/.test(x)) && !r2.some((x) => /^Əli/.test(x)), "Günel: Nurlana sold 4 to her patients, her part 60: " + JSON.stringify(r2));
    check(!s.errors.length, "no page errors (Günel): " + s.errors.join("; "));
  } finally { await s.close(); }

  // the admin: each person's part — Əli 18+36 = 54, Günel 60, the passer-by sales give no specialist anything
  s = await open(OWNER, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await toProd(p);
    const r3 = await rows(p, '[data-st^="prod-"]');
    check(r3.some((x) => /^Əli\|1\|25.*\|54/.test(x)) && r3.some((x) => /^Günel\|0\|0.*\|60/.test(x)) && r3.some((x) => /^Cəmi\|9\|225.*\|114/.test(x)), "admin: parts per person: " + JSON.stringify(r3));
    check(!s.errors.length, "no page errors (admin): " + s.errors.join("; "));
  } finally { await s.close(); }
};

// A5-14 (independent acceptance review of audit 5): (1) a sale stored by the server with its answer lost, then saved
// again with ANOTHER quantity, gave a second row (3 pieces counted instead of 2); (2) the unsaved-sale draft was one
// slot: a sale that failed while the next sale's window was open was overwritten by that sale and lost on reload.
const { open, check, OWNER, seed } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  db.products = [{ id: "cccccccc-0000-4000-8000-000000000001", name: "Misvak", price: 3, archived: false, sort: 1, created_at: now }];
  const s = await open(OWNER, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
    await p.click('#tabs [data-tab="cash"]'); await p.waitForTimeout(200);
    // (1) 1 piece stored, answer lost; the window comes back; one more tap → 2 pieces; save
    let lose = true;
    await p.route("**/rest/v1/product_sales*", async (r) => {
      if (r.request().method() === "POST" && lose) { lose = false; const b = JSON.parse(r.request().postData()); (Array.isArray(b) ? b : [b]).forEach((x) => db.product_sales.push({ ...x, created_by: OWNER, created_at: now })); return r.abort("connectionreset"); }
      return r.fallback(); });
    await p.click('[data-act="new-prod"]'); await p.locator("#sheet .pbtn").first().waitFor(); await p.click("#sheet .pbtn"); await p.click('[data-act="sell-save"]');
    await p.locator('#sheet [data-act="sell-save"]').waitFor({ timeout: 12000 }); await p.waitForTimeout(300);
    await p.click("#sheet .pbtn"); await p.click('[data-act="sell-save"]'); await p.waitForTimeout(900);
    const q = db.product_sales.map((x) => x.qty).reduce((a, b) => a + b, 0);
    check(db.product_sales.length === 1 && q === 2, "one row with 2 pieces: " + JSON.stringify(db.product_sales.map((x) => x.qty)));
    await p.unroute("**/rest/v1/product_sales*");
    // (2) sale A fails slowly while the window of sale B is already open; B is saved; reload → A is offered
    let first = true;
    await p.route("**/rest/v1/product_sales*", async (r) => {
      if (r.request().method() === "POST" && first) { first = false; await new Promise((ok) => setTimeout(ok, 1500)); return r.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' }); }
      return r.fallback(); });
    await p.click('[data-act="new-prod"]'); await p.locator("#sheet .pbtn").first().waitFor(); for (let i = 0; i < 3; i++) await p.click("#sheet .pbtn"); await p.click('[data-act="sell-save"]');
    await p.waitForTimeout(150); await p.click('[data-act="new-prod"]'); await p.locator("#sheet .pbtn").first().waitFor(); await p.click("#sheet .pbtn");
    await p.waitForTimeout(2200);   // A has failed meanwhile
    await p.click('#sheet [data-act="sell-save"]'); await p.waitForTimeout(900);
    await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2600);
    await p.click('#tabs [data-tab="cash"]'); await p.waitForTimeout(300);
    check(/Yadda saxlanmayan satış: 3 məhsul/.test(await p.textContent("#main")), "the failed sale A (3 pieces) is still offered after the reload");
    await p.click('[data-act="sell-draft-open"]'); await p.locator('#sheet [data-act="sell-save"]').waitFor(); await p.click('#sheet [data-act="sell-save"]'); await p.waitForTimeout(900);
    check(JSON.stringify(db.product_sales.map((x) => x.qty).sort()) === "[1,2,3]", "all three sales once: " + JSON.stringify(db.product_sales.map((x) => x.qty)));
    check(!/Yadda saxlanmayan satış/.test(await p.textContent("#main")), "nothing left to offer");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

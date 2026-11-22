// Stability audit S-05: an expense or a product sale whose write did not reach the database (no network, server
// error) must not stay in the list as if saved — it disappeared after a reload, so the user never typed it again.
// Now: the line is taken back, the form opens again with what was typed, and the message says so; nothing in the DB.
const { open, check, OWNER, seed } = require("../lib");
module.exports = async () => {
  const db = seed(); db.products = [{ id: "cccccccc-0000-4000-8000-000000000001", name: "Zeytun yağı", price: 25, archived: false, sort: 1, created_at: "2026-11-01T00:00:00Z" }];
  const s = await open(OWNER, { db, viewport: { width: 390, height: 844 } });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.route("**/rest/v1/expenses*", (r) => (r.request().method() === "POST" ? r.abort("internetdisconnected") : r.fallback()));
    await p.route("**/rest/v1/product_sales*", (r) => (r.request().method() === "POST" ? r.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' }) : r.fallback()));
    await p.click('#tabs [data-tab="cash"]'); await p.waitForTimeout(400);
    // expense
    await p.click('[data-act="new-expense"]'); await p.fill("#x-title", "Kirayə"); await p.fill("#x-amount", "300");
    await p.click('[data-act="save-expense"]'); await p.waitForTimeout(2500);
    const inList = await p.evaluate(() => [...document.querySelectorAll("#main *")].some((e) => e.children.length === 0 && /Kirayə/.test(e.textContent)));
    const form = await p.evaluate(() => { const t = document.getElementById("x-title"), a = document.getElementById("x-amount"); return t && !document.getElementById("overlay").hidden ? [t.value, a.value] : null; });
    check(!inList, "expense: the failed line is not left in the list as saved");
    check(form && form[0] === "Kirayə" && form[1] === "300", "expense: the form is open again with what was typed: " + JSON.stringify(form));
    check(!(s.db.expenses || []).length, "expense: nothing in the database");
    await p.click('[data-act="close"]').catch(() => {}); await p.waitForTimeout(400);
    // product sale (server answers 500) — owner 22.11: tapped from the product buttons
    await p.click('[data-act="new-prod"]'); await p.locator(".pbtn").first().waitFor();
    await p.click(".pbtn"); await p.click('[data-act="sell-save"]'); await p.waitForTimeout(2500);
    const pForm = await p.evaluate(() => { const b = document.querySelector(".pbtn.on"), t = document.querySelector("#sheet .ptotal"); return b && !document.getElementById("overlay").hidden ? [b.textContent, (t.textContent.match(/\d+/g) || []).pop()] : null; });
    const pList = await p.evaluate(() => [...document.querySelectorAll("#main *")].some((e) => e.children.length === 0 && /Zeytun/.test(e.textContent)));
    check(!pList, "product: the failed sale is not left in the list");
    check(pForm && /Zeytun/.test(pForm[0]) && pForm[1] === "25", "product: the window is open again with the tapped products: " + JSON.stringify(pForm));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

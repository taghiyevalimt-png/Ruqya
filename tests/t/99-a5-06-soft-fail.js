// A5-06 (audit 5, general audit — silent errors, soft()): when one of the lists (sales, expenses, manual statistics
// edits, shares, breaks…) did not load because of a passing server or network error, soft() turned the error into
// «this table does not exist»: Kassa and the statistics showed 0 sales, specialists lost the Kassa tab, breaks
// vanished — and nothing said it was an error. Only a really missing table (older install) may give «none».
const { open, check, OWNER, seed, bakuToday } = require("../lib");
module.exports = async () => {
  const db = seed(), t = bakuToday(), now = new Date().toISOString();
  db.products = [{ id: "cccccccc-0000-4000-8000-000000000001", name: "Zeytun yağı", price: 25, archived: false, sort: 1, created_at: now }];
  db.product_sales = [{ id: "dddddddd-0000-4000-8000-000000000001", date: t, product_id: "cccccccc-0000-4000-8000-000000000001", qty: 2, price: 25, amount: 50, names: "Zeytun yağı", created_by: OWNER, created_at: now }];
  db.expenses = [{ id: "eeeeeeee-0000-4000-8000-000000000001", date: t, title: "Kirayə sınaq", amount: 300, created_by: OWNER, created_at: now }];
  const s = await open(OWNER, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await p.click('#tabs [data-tab="cash"]'); await p.waitForTimeout(300);
    const before = await p.textContent("#main");
    check(/Zeytun/.test(before) && /Kirayə sınaq/.test(before), "loaded: the sale and the expense are in Kassa");
    let bad = 0;
    for (const tb of ["product_sales", "expenses"]) await p.route("**/rest/v1/" + tb + "*", (r) => (r.request().method() === "GET" && bad < 6 ? (bad++, r.fulfill({ status: 503, contentType: "application/json", body: '{"message":"Service Unavailable"}' })) : r.fallback()));
    // the connection comes back: the app reloads everything
    await p.evaluate(() => window.dispatchEvent(new Event("online")));
    await p.waitForTimeout(2500);
    check(bad > 0, "the failing answers were really asked for: " + bad);
    const mid = await p.evaluate(() => document.body.innerText);
    check(/Zeytun/.test(mid) && /Kirayə sınaq/.test(mid), "during the failure the loaded sale and expense are not replaced by «nothing»: " + mid.slice(0, 200).replace(/\n/g, " | "));
    check(/yükləmək olmadı|İnternet/i.test(mid), "the failure is said, not hidden");
    await p.waitForTimeout(16000);   // after the retry (server fine again) everything is there and the message is gone
    const after = await p.textContent("#main");
    check(/Zeytun/.test(after) && /Kirayə sınaq/.test(after), "after the retry everything is there");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

// A5-03 / A5-04 (found by the independent «breaker» of audit 5): (1) the server stores a sale (or a booking) but the
// answer is lost: the app took it back and reopened the window — saving again wrote a SECOND row; (2) a sale saved
// while the network was down was lost when the page was reloaded (bookings had a draft, sales did not).
// Now a retry reuses the same ids (the server keeps one row) and an unconfirmed sale is kept on the phone.
const { open, check, OWNER, seed, R1, bakuToday } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString(); db.appts = [];
  db.products = [{ id: "cccccccc-0000-4000-8000-000000000001", name: "Misvak", price: 3, archived: false, sort: 1, created_at: now }];
  const s = await open(OWNER, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
    // (1) sale: stored, answer lost
    let lose = true;
    await p.route("**/rest/v1/product_sales*", async (r) => {
      if (r.request().method() === "POST" && lose) { lose = false; const b = JSON.parse(r.request().postData()); (Array.isArray(b) ? b : [b]).forEach((x) => db.product_sales.push({ ...x, created_by: OWNER, created_at: now })); return r.abort("connectionreset"); }
      return r.fallback();
    });
    await p.click('#tabs [data-tab="cash"]'); await p.click('[data-act="new-prod"]'); await p.locator("#sheet .pbtn").first().waitFor();
    await p.click("#sheet .pbtn"); await p.click('[data-act="sell-save"]');
    await p.locator('#sheet [data-act="sell-save"]').waitFor({ timeout: 12000 });
    await p.click('[data-act="sell-save"]'); await p.waitForTimeout(800);
    check(db.product_sales.length === 1, "one sale in the database after the retry, not two: " + db.product_sales.length);
    // (2) booking: stored, answer lost, «Geri aç», «Yaz» again
    let loseA = true;
    await p.route("**/rest/v1/appts*", async (r) => {
      if (r.request().method() === "POST" && loseA) { loseA = false; const b = JSON.parse(r.request().postData()); (Array.isArray(b) ? b : [b]).forEach((x) => db.appts.push({ status: "wait", place: "ofis", follow: 0, duration: 90, ...x, created_by: OWNER, created_at: now, updated_at: now })); return r.abort("connectionreset"); }
      return r.fallback();
    });
    await p.click('#tabs [data-tab="day"]'); await p.click("#fab"); await p.locator("#f-name").waitFor();
    await p.selectOption("#f-reader", R1); await p.fill("#f-name", "Təkrar Yoxdur"); await p.fill("#f-phone", "050 123 45 67"); await p.fill("#f-time", "20:00");
    await p.click('[data-act="save-appt"]'); await p.waitForTimeout(1500);
    await p.locator('[data-act="draft-open"]').waitFor({ timeout: 15000 }); await p.click('[data-act="draft-open"]'); await p.locator("#f-name").waitFor();
    await p.click('[data-act="save-appt"]'); await p.waitForTimeout(800);
    const err = await p.evaluate(() => { const e = document.getElementById("f-err"); return e && !e.hidden ? e.textContent : ""; });
    check(!err, "no «this time is busy» with the patient's own booking: " + err);
    check(db.appts.filter((a) => a.name === "Təkrar Yoxdur").length === 1, "one booking in the database: " + db.appts.filter((a) => a.name === "Təkrar Yoxdur").length);
    // (3) a sale saved offline, the page reloaded: it is offered again and saved once
    await p.click('#tabs [data-tab="cash"]'); s.ctl.offline = true;
    await p.click('[data-act="new-prod"]'); await p.locator("#sheet .pbtn").first().waitFor(); await p.click("#sheet .pbtn"); await p.click("#sheet .pbtn"); await p.click('[data-act="sell-save"]'); await p.waitForTimeout(800);
    s.ctl.offline = false; await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2600);
    await p.click('#tabs [data-tab="cash"]'); await p.waitForTimeout(300);
    check(/Yadda saxlanmayan satış: 2 məhsul/.test(await p.textContent("#main")), "after the reload Kassa offers the unsaved sale");
    await p.click('[data-act="sell-draft-open"]'); await p.locator('#sheet [data-act="sell-save"]').waitFor(); await p.click('[data-act="sell-save"]'); await p.waitForTimeout(800);
    check(db.product_sales.length === 2 && db.product_sales[1].qty === 2, "saved once with its 2 pieces: " + JSON.stringify(db.product_sales.map((x) => x.qty)));
    check(!/Yadda saxlanmayan satış/.test(await p.textContent("#main")), "the notice is gone once it is saved");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

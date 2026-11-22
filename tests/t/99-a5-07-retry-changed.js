// A5-07 (audit 5: «the same bug in other places» after A5-03): an expense (and an old-style sale) saved again after a
// lost answer was a second row; a booking saved again with a changed time after a lost answer kept the OLD time on
// the server (the retry was ignored) while the phone showed the new one. Now the retry is the same row with the
// latest values.
const { open, check, OWNER, seed, R1 } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString(); db.appts = [];
  const s = await open(OWNER, { db });
  const lose = (p, tb, def) => { let once = true; return p.route("**/rest/v1/" + tb + "*", async (r) => {
    if (r.request().method() === "POST" && once) { once = false; const b = JSON.parse(r.request().postData()); (Array.isArray(b) ? b : [b]).forEach((x) => db[tb].push({ ...def, ...x, created_by: OWNER, created_at: now, updated_at: now })); return r.abort("connectionreset"); }
    return r.fallback(); }); };
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
    // expense: stored, answer lost, the form comes back, the amount is corrected, saved again
    await lose(p, "expenses", {});
    await p.click('#tabs [data-tab="cash"]'); await p.click('[data-act="new-expense"]'); await p.fill("#x-title", "Sınaq xərci"); await p.fill("#x-amount", "300");
    await p.click('[data-act="save-expense"]'); await p.locator("#x-title").waitFor({ timeout: 12000 }); await p.waitForTimeout(400);
    await p.fill("#x-amount", "350"); await p.click('[data-act="save-expense"]'); await p.waitForTimeout(900);
    const ex = db.expenses.filter((e) => e.title === "Sınaq xərci");
    check(ex.length === 1 && +ex[0].amount === 350, "one expense with the corrected amount: " + JSON.stringify(ex.map((e) => e.amount)));
    // booking: stored, answer lost, «Geri aç», the time is changed, «Yaz» again
    await lose(p, "appts", { status: "wait", place: "ofis", follow: 0, duration: 90 });
    await p.click('#tabs [data-tab="day"]'); await p.click("#fab"); await p.locator("#f-name").waitFor();
    await p.selectOption("#f-reader", R1); await p.fill("#f-name", "Vaxtı Dəyişən"); await p.fill("#f-phone", "050 123 45 68"); await p.fill("#f-time", "20:00");
    await p.click('[data-act="save-appt"]'); await p.waitForTimeout(1500);
    await p.locator('[data-act="draft-open"]').waitFor({ timeout: 15000 }); await p.click('[data-act="draft-open"]'); await p.locator("#f-name").waitFor();
    await p.fill("#f-time", "21:30"); await p.click('[data-act="save-appt"]'); await p.waitForTimeout(900);
    const ap = db.appts.filter((a) => a.name === "Vaxtı Dəyişən");
    check(ap.length === 1 && String(ap[0].time).slice(0, 5) === "21:30", "one booking, at the new time: " + JSON.stringify(ap.map((a) => a.time)));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

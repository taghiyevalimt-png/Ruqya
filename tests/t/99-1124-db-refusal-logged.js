// 24.11 (bug hunt): on 23.11 the database refused 8 new bookings («Qayda: qiymet»), the staff saw «Yadda saxlanmadı»,
// but nothing reached the admins' error list (app_errors) — such a fault stayed invisible. Now a save the server refuses
// is written there too: method, table, code and the server's words; the booking is kept as a draft as before.
const { open, check, AGENT, seed, R1, bakuToday } = require("../lib");
module.exports = async () => {
  const s = await open(AGENT, { db: seed() });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
    await p.route("**/rest/v1/appts*", (r) => r.request().method() === "POST" ? r.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "23514", message: "Qayda: qiymet", details: null, hint: null }) }) : r.fallback());
    await p.click('#tabs [data-tab="day"]'); await p.click("#fab"); await p.locator("#f-reader").waitFor();
    await p.selectOption("#f-reader", R1); await p.fill("#f-name", "Natiq"); await p.fill("#f-phone", "055 409 16 97"); await p.fill("#f-time", "14:30");
    await p.click('[data-act="save-appt"]'); await p.waitForTimeout(1200);
    check(/düzgün deyil/.test(await p.textContent("body")), "the staff see «Yadda saxlanmadı: yazılan məlumat düzgün deyil»");
    check(await p.locator('[data-act="draft-open"], .draftbox').count() > 0, "what was typed is kept («Geri aç»)");
    await p.waitForTimeout(4500);   // the error list is sent 3 s after an error
    const e = (s.db.app_errors || []).map((x) => x.m);
    check(e.some((m) => /^DB POST appts 23514: Qayda: qiymet/.test(m)), "the refusal is in app_errors: " + JSON.stringify(e));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

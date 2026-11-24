// A double tap on "delete" does not skip "press again"; fonts come from the app itself, nothing from Google.
const { open, check, AGENT } = require("../lib");

module.exports = async () => {
  const s = await open(AGENT);
  try {
    const p = s.page, ext = [];
    p.on("request", (r) => { if (/google/.test(r.url())) ext.push(r.url()); });
    await p.reload();
    await p.waitForSelector("text=Test Pasiyent", { timeout: 15000 });
    await p.waitForTimeout(3200);
    await p.click("#cal >> text=Test Pasiyent");
    await p.dblclick('[data-act="del-appt"]');
    await p.waitForTimeout(500);
    check(s.db.appts.length === 1, "double tap did not delete");
    await p.waitForTimeout(700);
    await p.click('[data-act="del-appt"]');
    await p.waitForTimeout(5800);   /* 24.11: the delete goes after the 5 s of «Geri al» */
    check(s.db.appts.length === 0, "a deliberate second press deletes");
    const f = await p.evaluate(() => document.fonts.check('600 16px "Golos Text"'));
    check(f, "Golos Text loaded from vendor/fonts");
    check(!ext.length, "no requests to Google: " + ext.join(", "));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

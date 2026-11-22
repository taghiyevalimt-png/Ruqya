// Audit 6 (5.4): the free Supabase project paused (the API answers 540 «project paused», or 503): the app shows a
// clear message — not a white screen and not «0 bookings» — and works again by itself once the project is back.
const { open, check, OWNER } = require("../lib");
module.exports = async () => {
  for (const status of [540, 503]) {
    const s = await open(OWNER);
    try {
      const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
      let down = true;
      await p.route("**/rest/v1/**", (r) => (down ? r.fulfill({ status, contentType: "application/json", body: JSON.stringify({ message: "Project paused" }) }) : r.fallback()));
      await p.reload(); await p.waitForTimeout(4000);
      const t = await p.evaluate(() => document.body.innerText);
      check(t.trim().length > 50, status + ": not a white screen");
      check(/yükləmək olmadı|İnternet/i.test(t), status + ": the failure is said: " + t.slice(0, 160).replace(/\n/g, " | "));
      down = false; await p.waitForTimeout(8000);
      const t2 = await p.evaluate(() => document.body.innerText);
      check(/Test Pasiyent/.test(t2) && !/yükləmək olmadı/.test(t2), status + ": back by itself when the project answers again");
      check(!s.errors.length, status + ": no page errors: " + s.errors.join("; "));
    } finally { await s.close(); }
  }
};

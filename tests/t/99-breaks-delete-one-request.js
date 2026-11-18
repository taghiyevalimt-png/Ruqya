// Stability audit S-03: deleting a break shared by several specialists («Hamısından sil») sends one request for all of
// them, so a broken connection cannot leave half of the group deleted.
const { open, check, OWNER, seed, uuid, R1, R2 } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  for (const rid of [R1, R2]) db.breaks.push({ id: uuid(), title: "Namaz", start_time: "13:00", end_time: "13:30", reader_id: rid, days: null, date_from: null, date_to: null, created_at: now });
  const s = await open(OWNER, { db, viewport: { width: 390, height: 844 } });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    const dels = []; p.on("request", (r) => { if (r.method() === "DELETE" && /\/rest\/v1\/breaks/.test(r.url())) dels.push(r.url()); });
    await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="breaks"]'); await p.waitForTimeout(300);
    await p.click('[data-act="brk-open"]:has-text("Namaz")'); await p.locator('#sheet button.danger[data-act="del-breaks"]').waitFor();
    const b = p.locator('#sheet button.danger[data-act="del-breaks"]'); await b.click(); await p.waitForTimeout(700); await b.click(); await p.waitForTimeout(800);
    check(dels.length === 1, "one delete request for the whole group: " + dels.length);
    check(s.db.breaks.length === 0, "both breaks deleted: " + s.db.breaks.length);
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

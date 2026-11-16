// F-02: an admin can wipe a patient's personal data; others do not see the button.
const { open, check, OWNER, AGENT } = require("../lib");
async function toCard(p) {
  await p.waitForSelector("text=Test Pasiyent", { timeout: 15000 }); await p.waitForTimeout(3200);
  await p.click('#tabs [data-tab="patients"]'); await p.click("#plist >> text=Test Pasiyent"); await p.waitForSelector(".pvisit");
}
module.exports = async () => {
  let s = await open(AGENT);
  try { await toCard(s.page); check((await s.page.locator('[data-act="anon"]').count()) === 0, "agent has no wipe button"); }
  finally { await s.close(); }
  s = await open(OWNER);
  try {
    const p = s.page; await toCard(p);
    await p.click('[data-act="anon"]');
    check(/geri qaytarmaq olmayacaq/.test(await p.textContent('[data-act="anon"]')), "asks again");
    check(s.db.appts[0].name === "Test Pasiyent", "nothing wiped on the first press");
    await p.waitForTimeout(700);
    await p.click('[data-act="anon"]');
    await p.waitForTimeout(1200);
    check(s.db.appts[0].name === "Anonim" && s.db.appts[0].phone === "", "wiped in the database");
    check((await p.locator("#overlay").isHidden()), "card closed");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

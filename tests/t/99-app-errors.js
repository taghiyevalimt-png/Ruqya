// Stability audit 2 (S-06): the errors of every phone reach one place. An agent's phone sends its error to the
// shared table (with version and screen); without internet it keeps it and sends it after the next successful load;
// the same error is sent once; the admin sees the errors of all phones with the name of the person, and can delete them.
const { open, check, OWNER, AGENT, seed } = require("../lib");
module.exports = async () => {
  const db = seed();
  const a = await open(AGENT, { db });
  try {
    const p = a.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(4500);
    await p.evaluate(() => setTimeout(() => { throw new Error("sınaq xətası 1"); }));
    await p.waitForTimeout(4500);
    const r1 = db.app_errors.filter((x) => /sınaq xətası 1/.test(x.m));
    check(r1.length === 1, "the error reached the shared table once: " + r1.length);
    check(r1[0] && r1[0].uid === AGENT && /^\d{14}$/.test(r1[0].v || "") && r1[0].tab === "day" && (r1[0].ua || "").length > 0, "with person, version, screen and browser: " + JSON.stringify(r1[0] && [r1[0].v, r1[0].tab]));
    // no internet for the table: the error stays on the phone and goes after the next successful load
    let block = true;
    await p.route("**/rest/v1/app_errors*", (r) => (block && r.request().method() === "POST" ? r.abort("internetdisconnected") : r.fallback()));
    await p.evaluate(() => setTimeout(() => { throw new Error("sınaq xətası 2"); }));
    await p.waitForTimeout(4500);
    check(!db.app_errors.some((x) => /sınaq xətası 2/.test(x.m)), "without connection nothing is written");
    const kept = await p.evaluate(() => JSON.parse(localStorage.getItem("ruqya.errlog") || "[]").filter((x) => /sınaq xətası 2/.test(x.m) && !x.sent).length);
    check(kept === 1, "the phone keeps it as not sent: " + kept);
    block = false;
    await p.evaluate(() => window.dispatchEvent(new Event("online"))); await p.waitForTimeout(6000);
    const r2 = db.app_errors.filter((x) => /sınaq xətası 2/.test(x.m));
    check(r2.length === 1, "after the next load it is sent, once: " + r2.length);
    check(db.app_errors.filter((x) => /sınaq xətası 1/.test(x.m)).length === 1, "the first error was not sent again");
  } finally { await a.close(); }
  // the admin sees all phones
  db.app_errors.push({ id: 900, at: "2026-11-18T10:00:00Z", uid: OWNER, v: "20261118", m: "admin telefonu", s: "", tab: "cash", ua: "x" });
  const o = await open(OWNER, { db });
  try {
    const p = o.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="acc"]'); await p.waitForTimeout(300);
    await p.locator('[data-act="errs-all"]').first().click(); await p.waitForTimeout(1200);
    const txt = await p.evaluate(() => { const e = document.querySelector(".errs-all"); return e ? e.innerText : ""; });
    check(/sınaq xətası 1/.test(txt) && /sınaq xətası 2/.test(txt) && /admin telefonu/.test(txt), "the admin sees the errors of all phones: " + txt.slice(0, 200));
    check(/Nurlana/.test(txt) && /Admin/.test(txt), "with the name of the person");
    await p.click('[data-act="errs-all-clear"]'); await p.waitForTimeout(800);
    check(db.app_errors.length === 0, "the admin deletes them: " + db.app_errors.length);
    check(!o.errors.length, "no page errors on the admin phone: " + o.errors.join("; "));
  } finally { await o.close(); }
};

// A5-11 (closes ST-3 from the audit of 18.11; audit 5 asks for it): when saving a new specialist, a manual statistics
// number or a new break did not reach the server, the window closed and what was typed was gone (expenses, sales
// and bookings already came back, S-05). Now the window opens again with what was typed; a retry after a lost answer
// is the same row.
const { open, check, OWNER, AGENT, seed, bakuToday } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  const s = await open(OWNER, { db });
  const failOnce = (p, tb, store) => { let once = true; return p.route("**/rest/v1/" + tb + "*", async (r) => {
    if (r.request().method() === "POST" && once) { once = false;
      if (store) { const b = JSON.parse(r.request().postData()); (Array.isArray(b) ? b : [b]).forEach((x) => db[tb].push({ ...x, created_by: OWNER, created_at: now })); return r.abort("connectionreset"); }
      return r.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' }); }
    return r.fallback(); }); };
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    // specialist: stored, answer lost → the window comes back with the name → saved again → one specialist
    await failOnce(p, "readers", true);
    await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="spec"]').catch(() => {}); await p.waitForTimeout(300);
    await p.click('[data-act="new-reader"] >> nth=0'); await p.locator("#r-name").waitFor(); await p.fill("#r-name", "Sınaq Mütəxəssis");
    await p.click('[data-act="save-reader"]'); await p.waitForTimeout(2500);
    const rn = await p.evaluate(() => { const e = document.getElementById("r-name"); return e && !document.getElementById("overlay").hidden ? e.value : null; });
    check(rn === "Sınaq Mütəxəssis", "specialist: the window is open again with the name: " + rn);
    if (rn) { await p.click('[data-act="save-reader"]'); await p.waitForTimeout(900); }
    check(db.readers.filter((r) => r.name === "Sınaq Mütəxəssis").length === 1, "specialist: one row in the database: " + db.readers.filter((r) => r.name === "Sınaq Mütəxəssis").length);
    // manual statistics number: server error → the window comes back with the number
    await failOnce(p, "stat_edits", false);
    await p.click('#tabs [data-tab="stats"]'); await p.click('#top [data-act="st-sec"][data-id="cweek"]'); await p.waitForTimeout(300);
    await p.click('[data-st="big-cweek"] [data-act="st-edit"][data-id="' + AGENT + '"][data-col="w"]'); await p.locator("#se-v").waitFor();
    await p.fill("#se-v", "7"); await p.click('[data-act="st-edit-save"]'); await p.waitForTimeout(2500);
    const sv = await p.evaluate(() => { const e = document.getElementById("se-v"); return e && !document.getElementById("overlay").hidden ? e.value : null; });
    check(sv === "7", "statistics: the window is open again with the number: " + sv);
    if (sv) { await p.click('[data-act="st-edit-save"]'); await p.waitForTimeout(900); }
    check(db.stat_edits.length === 1 && +db.stat_edits[0].value === 7, "statistics: saved once: " + JSON.stringify(db.stat_edits.map((x) => x.value)));
    // new break: server error → the window comes back as typed
    await failOnce(p, "breaks", false);
    await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="breaks"]'); await p.waitForTimeout(200);
    await p.click('[data-act="new-break"]'); await p.locator("#b-title").waitFor();
    await p.fill("#b-title", "Sınaq fasilə"); await p.fill("#b-date", bakuToday(1)); await p.fill("#b-start", "13:00"); await p.fill("#b-end", "13:40");
    await p.click('[data-act="save-break"]'); await p.waitForTimeout(2500);
    const bt = await p.evaluate(() => { const e = document.getElementById("b-title"); return e && !document.getElementById("overlay").hidden ? [e.value, document.getElementById("b-start").value] : null; });
    check(bt && bt[0] === "Sınaq fasilə" && bt[1] === "13:00", "break: the window is open again as typed: " + JSON.stringify(bt));
    if (bt) { await p.click('[data-act="save-break"]'); await p.waitForTimeout(900); }
    check(db.breaks.filter((b) => b.title === "Sınaq fasilə").length === 1, "break: one row in the database");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

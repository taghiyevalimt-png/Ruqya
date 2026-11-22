// A6-10 (audit 6, ST-3 «… сотрудника …»): the last form of ST-3 — editing a staff member (name, role, «not in the
// statistics»): when the change did not reach the server the window closed and what was typed was gone.
// Now it opens again as it was typed.
const { open, check, OWNER, AGENT } = require("../lib");
module.exports = async () => {
  const s = await open(OWNER);
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="staff"]'); await p.waitForTimeout(300);
    await p.click('[data-act="edit-staff"][data-id="' + AGENT + '"]'); await p.locator("#s-name").waitFor();
    await p.fill("#s-name", "Yeni Ad Sınaq");
    s.ctl.failWrite = "net";
    await p.click('[data-act="save-staff"]'); await p.waitForTimeout(2500);
    const v = await p.evaluate(() => { const e = document.getElementById("s-name"); return e && !document.getElementById("overlay").hidden ? e.value : null; });
    check(v === "Yeni Ad Sınaq", "the staff form is open again with the typed name: " + v);
    check(!s.db.staff.some((x) => x.name === "Yeni Ad Sınaq"), "nothing changed in the database");
    if (v) { await p.click('[data-act="save-staff"]'); await p.waitForTimeout(900); }
    check(s.db.staff.some((x) => x.name === "Yeni Ad Sınaq"), "saved on the second try");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

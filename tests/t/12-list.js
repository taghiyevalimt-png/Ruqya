// List view: «Ləğv et» cancels (never deletes); a cancelled booking there can be deleted completely only on purpose.
const { open, check, AGENT } = require("../lib");
module.exports = async () => {
  const s = await open(AGENT);
  try {
    const p = s.page;
    await p.waitForSelector("text=Test Pasiyent", { timeout: 15000 }); await p.waitForTimeout(3200);
    await p.click('[data-act="view"][data-id="list"]');
    check((await p.locator('#main [data-act="del-row"]').count()) === 0, "no delete button on an active booking");
    await p.click('#main [data-act="cancel-appt"]'); await p.waitForTimeout(700);
    await p.click('#main [data-act="cancel-appt"]'); await p.waitForTimeout(900);
    check(s.db.appts.length === 1 && s.db.appts[0].status === "cancel", "list «Ləğv et» cancels");
    await p.click('#main [data-act="del-row"]');
    check(/Tamamilə silinəcək/.test(await p.textContent('#main [data-act="del-row"]')), "full delete asks again");
    await p.waitForTimeout(700);
    await p.click('#main [data-act="del-row"]'); await p.waitForTimeout(900);
    check(s.db.appts.length === 1 && await p.isVisible("#undo.on"), "24.11: gone from the screen, «Geri al» for 5 s");
    await p.waitForTimeout(5000);
    check(s.db.appts.length === 0, "deleted on the second deliberate press (after the 5 s of «Geri al»)");
    await p.click('[data-act="view"][data-id="grid"]');
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

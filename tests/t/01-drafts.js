// F-01 / F-06 / F-09: what was typed in a booking form is never lost, and a booking the server did not take never looks saved.
const { open, check, AGENT } = require("../lib");

async function ready(p) { await p.waitForSelector("text=Test Pasiyent", { timeout: 15000 }); await p.waitForTimeout(3200); }
async function fill(p, name, time) {
  await p.click("#fab"); await p.waitForSelector("#f-reader");
  await p.selectOption("#f-reader", { index: 1 });
  await p.selectOption("#f-dur", "60");
  await p.fill("#f-time", time);
  await p.fill("#f-name", name);
  await p.fill("#f-phone", "050 222 33 44");
}
const draftShown = (p) => p.locator(".draftbox").count();

module.exports = async () => {
  // 1. network drops while saving
  let s = await open(AGENT);
  try {
    const p = s.page; await ready(p);
    await fill(p, "Şəbəkə Testi", "14:00");
    s.ctl.failWrite = "net";
    await p.click('[data-act="save-appt"]');
    await p.waitForTimeout(1200);
    check(!s.db.appts.some((a) => a.name === "Şəbəkə Testi"), "not in db");
    check((await p.locator("#cal >> text=Şəbəkə Testi").count()) === 0, "failed booking is not left on the calendar");
    check((await draftShown(p)) === 1, "draft notice shown after network failure");
    await p.click('[data-act="draft-open"]');
    check((await p.inputValue("#f-name")) === "Şəbəkə Testi", "name restored");
    check((await p.inputValue("#f-time")) === "14:00", "time restored");
    check((await p.inputValue("#f-dur")) === "60", "duration restored");
    await p.click('[data-act="save-appt"]');
    await p.waitForTimeout(1000);
    check(s.db.appts.some((a) => a.name === "Şəbəkə Testi"), "saved on second try");
    check((await draftShown(p)) === 0, "draft gone after a good save");
    // reload: no stale draft comes back
    await p.reload(); await ready(p);
    check((await draftShown(p)) === 0, "no draft after reload");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }

  // 2. sign-in expired and cannot be renewed
  s = await open(AGENT);
  try {
    const p = s.page; await ready(p);
    await fill(p, "Giriş Testi", "15:00");
    s.ctl.expired = true; s.ctl.authDown = true;
    await p.click('[data-act="save-appt"]');
    await p.waitForSelector("#l-mail", { timeout: 10000 });
    const msg = await p.textContent("#l-err");
    check(/Girişin vaxtı bitib/.test(msg), "sign-in screen says the session ended: " + msg);
    s.ctl.authDown = false;
    await p.fill("#l-mail", "agent@ruqya.az"); await p.fill("#l-pass", "secret1");
    await p.click('[data-act="login"]');
    await p.waitForSelector(".draftbox", { timeout: 15000 });
    await p.waitForTimeout(500);
    await p.click('[data-act="draft-open"]');
    check((await p.inputValue("#f-name")) === "Giriş Testi", "typing survived the expired sign-in");
    await p.click('[data-act="save-appt"]');
    await p.waitForTimeout(1000);
    check(s.db.appts.some((a) => a.name === "Giriş Testi"), "saved after signing in again");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }

  // 3. form closed by the phone's back button / × with typing in it
  s = await open(AGENT);
  try {
    const p = s.page; await ready(p);
    await fill(p, "Geri Testi", "16:00");
    await p.goBack();
    await p.waitForTimeout(500);
    check((await p.locator("#overlay").isHidden()), "form closed by back");
    check((await draftShown(p)) === 1, "typing kept after back");
    await p.click('[data-act="draft-open"]');
    check((await p.inputValue("#f-name")) === "Geri Testi", "name back after reopening");
    await p.click('[data-act="close"]');
    await p.waitForTimeout(300);
    await p.click('[data-act="draft-drop"]');
    check((await draftShown(p)) === 0, "draft can be thrown away");
    // closing an empty form leaves nothing behind
    await p.click("#fab"); await p.waitForSelector("#f-reader"); await p.click('[data-act="close"]'); await p.waitForTimeout(300);
    check((await draftShown(p)) === 0, "empty form leaves no draft");
  } finally { await s.close(); }

  // 4. server refuses (slot taken on another phone) and an edit that fails goes back to the server copy
  s = await open(AGENT);
  try {
    const p = s.page; await ready(p);
    await fill(p, "Tutulub Testi", "17:00");
    s.ctl.failWrite = { status: 409, body: { code: "23505", message: "Bu saat artiq tutulub" } };
    await p.click('[data-act="save-appt"]');
    await p.waitForTimeout(1200);
    check((await draftShown(p)) === 1, "draft after refusal");
    check(/Bu saat artıq tutulub/.test(await p.textContent("#main")), "refusal reason shown");
    // edit of an existing booking fails: the old name comes back
    await p.click('[data-act="draft-drop"]');
    await p.click("#cal >> text=Test Pasiyent");
    await p.click('[data-act="edit-appt"]');
    await p.fill("#f-name", "Dəyişmiş Ad");
    s.ctl.failWrite = "net";
    await p.click('[data-act="save-appt"]');
    await p.waitForTimeout(1200);
    check(s.db.appts[0].name === "Test Pasiyent", "db unchanged");
    check((await p.locator("#cal >> text=Dəyişmiş Ad").count()) === 0, "failed edit is not left on screen");
    check((await p.locator("#cal >> text=Test Pasiyent").count()) === 1, "old name back on screen");
    await p.click('[data-act="draft-open"]');
    check((await p.inputValue("#f-name")) === "Dəyişmiş Ad", "edit typing kept");
    await p.click('[data-act="save-appt"]');
    await p.waitForTimeout(1000);
    check(s.db.appts[0].name === "Dəyişmiş Ad", "edit saved on second try");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

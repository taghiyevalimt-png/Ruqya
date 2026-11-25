// 25.11 (hunt 6): a booking form being typed in when the sign-in runs out (the token could not be renewed, supabase-js
// signs out by itself) lost all the typing: signedOut() cleared the user before the form was closed, so the draft was
// not kept. Now the typing is kept as a draft and offered with «Geri aç» after signing in again.
const { open, check, AGENT } = require("../lib");
module.exports = async () => {
  const s = await open(AGENT, { clock: Date.now() });
  try {
    const p = s.page;
    await p.waitForSelector("text=Test Pasiyent", { timeout: 15000 });
    await p.click("#fab"); await p.waitForSelector("#f-name");
    await p.fill("#f-name", "Yazılan Ad"); await p.fill("#f-phone", "050 999 88 77");
    s.ctl.authDown = true;                       // the refresh token is refused
    await p.clock.fastForward(2 * 3600e3);       // the access token expires, supabase-js tries to renew it and signs out
    await p.waitForSelector("#l-mail", { timeout: 15000 });
    const d = await p.evaluate(() => JSON.parse(localStorage.getItem("ruqya.draft.v1") || "null"));
    check(d && d.v && d.v.name === "Yazılan Ad" && d.v.phone === "050 999 88 77", "typing kept as a draft: " + JSON.stringify(d));
    // signing in again offers it back
    s.ctl.authDown = false;
    await p.fill("#l-mail", "agent@ruqya.az"); await p.fill("#l-pass", "x12345678");
    await p.click('[data-act="login"]').catch(() => p.keyboard.press("Enter"));
    await p.waitForSelector('[data-act="draft-open"]', { timeout: 15000 });
    await p.click('[data-act="draft-open"]'); await p.waitForSelector("#f-name");
    check((await p.inputValue("#f-name")) === "Yazılan Ad", "the form opens with the name");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
  // the idle sign-out (7 days) still removes the draft with all other data
  const s2 = await open(AGENT, { clock: Date.now() });
  try {
    const p = s2.page;
    await p.waitForSelector("text=Test Pasiyent", { timeout: 15000 });
    await p.click("#fab"); await p.waitForSelector("#f-name");
    await p.fill("#f-name", "Unudulan");
    await p.clock.fastForward(8 * 24 * 3600e3);
    await p.waitForSelector("#l-mail", { timeout: 15000 });
    check(!(await p.evaluate(() => localStorage.getItem("ruqya.draft.v1"))), "idle sign-out leaves no draft");
  } finally { await s2.close(); }
};

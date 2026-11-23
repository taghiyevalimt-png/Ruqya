// 23.11 (found in the sign-in log: «Refresh Token Not Found» right after a sign-out on another device): «Çıxış» signs out
// this device only (scope=local); the account stays signed in on the employee's other phones and computers.
const { open, check, AGENT } = require("../lib");
module.exports = async () => {
  const s = await open(AGENT);
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
    await p.click('#tabs [data-tab="readers"]'); await p.click('[data-act="set-sec"][data-id="acc"]'); await p.waitForTimeout(300);
    const before = s.ctl.log.length;
    await p.click('[data-act="logout"]'); await p.waitForTimeout(1200);
    const calls = s.ctl.log.slice(before).filter((x) => /\/auth\/v1\/logout/.test(x));
    check(calls.length === 1 && /scope=local/.test(calls[0]), "sign-out of this device only: " + JSON.stringify(calls));
    check(await p.locator('input[type="password"]').count() === 1, "this phone shows the sign-in screen");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

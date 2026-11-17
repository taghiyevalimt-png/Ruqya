// F-20 idle sign-out after 12 h, F-32 sign-out in one tab signs out the others, F-29 midnight with a form open.
const { open, check, AGENT, tokenKey } = require("../lib");

module.exports = async () => {
  // F-20: opened after 8 days without a touch (owner 17.11: sign-out after 7 days, was 12 hours) -> sign-in screen, no patient data left on the device
  let s = await open(AGENT, {
    init: [() => { if (!sessionStorage.getItem("idle")) { localStorage.setItem("ruqya.seen", String(Date.now() - 8 * 24 * 3600e3)); localStorage.setItem("ruqya.cache.v1", '{"u":"x","t":1,"s":{}}'); sessionStorage.setItem("idle", "1"); } }, null],
  }).catch((e) => { throw e; });
  try {
    const p = s.page;
    await p.waitForSelector("#l-mail", { timeout: 10000 });
    check(/7 gün/.test(await p.textContent("#l-err")), "idle message shown");
    const left = await p.evaluate((k) => [localStorage.getItem(k), localStorage.getItem("ruqya.cache.v1")], tokenKey);
    check(!left[0] && !left[1], "session and data copy removed");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }

  // used recently -> stays signed in; the 7 days are counted while the app stays open too
  s = await open(AGENT, { clock: Date.now() });
  try {
    const p = s.page;
    await p.waitForSelector("text=Test Pasiyent", { timeout: 15000 });
    await p.clock.fastForward(6.5 * 24 * 3600e3);
    check((await p.locator("#l-mail").count()) === 0, "still signed in after 11 h");
    await p.clock.fastForward(1 * 24 * 3600e3);
    await p.waitForSelector("#l-mail", { timeout: 10000 });
    { const m = await p.textContent("#l-err"); check(/7 gün/.test(m), "signed out after 7 days idle while open: " + m); }
  } finally { await s.close(); }

  // F-32: two tabs, sign out in one
  s = await open(AGENT);
  try {
    const p = s.page;
    await p.waitForSelector("text=Test Pasiyent", { timeout: 15000 });
    const p2 = await s.context.newPage();
    await p2.goto(s.base);
    await p2.waitForSelector("text=Test Pasiyent", { timeout: 15000 });
    await p.waitForTimeout(3200);
    await p.click('#tabs [data-tab="readers"]');
    await p.click('[data-act="set-sec"][data-id="acc"]').catch(() => {});
    await p.click('[data-act="logout"]');
    await p.waitForSelector("#l-mail", { timeout: 10000 });
    await p2.waitForSelector("#l-mail", { timeout: 10000 });
    check((await p2.locator("text=Test Pasiyent").count()) === 0, "other tab no longer shows patients");
  } finally { await s.close(); }

  // F-29: a new-booking form opened at 23:58 Baku moves to the new day at midnight
  const t = new Date(); const baku = new Date(t.getTime() + 4 * 3600e3);
  const at = Date.UTC(baku.getUTCFullYear(), baku.getUTCMonth(), baku.getUTCDate(), 23, 58) - 4 * 3600e3;
  s = await open(AGENT, { clock: at });
  try {
    const p = s.page;
    await p.waitForSelector("#fab:not([hidden])", { timeout: 15000 });
    await p.clock.fastForward(3500);
    await p.click("#fab"); await p.waitForSelector("#f-reader");
    const d0 = await p.inputValue("#f-date");
    await p.fill("#f-name", "Gecə");
    await p.clock.fastForward(3 * 60000);
    const d1 = await p.inputValue("#f-date");
    check(d1 > d0, "form date moved past midnight: " + d0 + " -> " + d1);
    check((await p.inputValue("#f-name")) === "Gecə", "typing kept");
    await p.click('[data-act="close"]');
    await p.click('[data-act="draft-drop"]').catch(() => {});
    const top = await p.textContent("#top");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

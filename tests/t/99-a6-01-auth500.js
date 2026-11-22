// A6-01 (audit 6, found in the live sign-in log of 22.11: 8 answers 500 from the sign-in server, three of them on
// «error finding refresh token: timeout»): when renewing the sign-in failed with 500 (a fault of the server, not
// a wrong token — that is 400), the staff member was signed out: supabase-js removed the session on every error
// except 502/503/504, and the app did the same. Now a 5xx is «no connection right now», the session is kept and
// renewed on the next try; only 400/401 (token really invalid) signs out.
const { open, check, AGENT } = require("../lib");
module.exports = async () => {
  const s = await open(AGENT);
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    const state = () => p.evaluate(() => ({ tabs: !document.getElementById("tabs").hidden, kept: Object.keys(localStorage).some((k) => /^sb-.*-auth-token$/.test(k)) }));
    // (1) the library renews the sign-in (as it does by itself before the hour runs out) and the server answers 500
    s.ctl.auth500 = 1;
    // (a second client of the same library on the same stored session — as the app's own does every hour)
    const renew = () => p.evaluate(() => window.supabase.createClient("https://ldkhdeehrrajvgrtieal.supabase.co", "sb_publishable_x", { auth: { autoRefreshToken: false } }).auth.refreshSession().then((x) => ({ err: x.error ? x.error.status || x.error.name : null, sess: !!(x.data && x.data.session) })));
    const r1 = await renew();
    await p.waitForTimeout(800);
    const t1 = await state();
    check(t1.kept && t1.tabs, "library renewal answered 500: still signed in, the session kept: " + JSON.stringify([r1, t1]));
    // (2) the app's own path (a save answered 401 → renew) and the server answers 500
    s.ctl.auth500 = 1;
    s.ctl.failWrite = { status: 401, body: { code: "PGRST301", message: "JWT expired" } };
    await p.click('#tabs [data-tab="cash"]'); await p.click('[data-act="new-expense"]'); await p.fill("#x-title", "Sınaq 401"); await p.fill("#x-amount", "5");
    await p.click('[data-act="save-expense"]'); await p.waitForTimeout(1500);
    const t2 = await state();
    check(t2.kept && t2.tabs, "app renewal answered 500: not signed out: " + JSON.stringify(t2));
    // (3) the server is back: renewing works
    const r3 = await renew();
    check(r3.sess, "the next renewal works: " + JSON.stringify(r3));
    // a really invalid token (400 invalid_grant) still signs out
    s.ctl.authDown = true;
    await renew(); await p.waitForTimeout(800);
    check(!(await state()).kept, "an invalid token (400) still ends the session");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

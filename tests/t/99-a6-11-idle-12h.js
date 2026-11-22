// S-09 (audit 6): the 12-hour sign-out a government customer requires (ASVS L2 V3.3.2) is ready behind one switch,
// IDLE_12H in index.html, off by the owner's decision of 17.11 (7 days). Off: 13 hours without use keeps the session.
// On (page served with the switch turned on): 13 hours signs out with the right message, 11 hours does not.
const { open, check, AGENT, tokenKey } = require("../lib");
async function run(on, hours) {
  const s = await open(AGENT, { bypassCSP: on });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 });
    if (on) await p.route((u) => /\/(index\.html)?(\?.*)?$/.test(new URL(u).pathname + new URL(u).search) && !/\/rest\/|\/auth\//.test(u.href), async (r) => {
      const res = await r.fetch(); const body = (await res.text()).replace("var IDLE_12H=false;", "var IDLE_12H=true;"); await r.fulfill({ response: res, body }); });
    await p.evaluate((h) => localStorage.setItem("ruqya.seen", String(Date.now() - h * 3600e3)), hours);
    await p.reload(); await p.waitForTimeout(3500);
    const out = await p.evaluate((k) => ({ login: !!document.getElementById("l-mail"), msg: (document.getElementById("l-err") || {}).textContent || "", token: !!localStorage.getItem(k), flag: /IDLE_12H=true/.test(document.documentElement.innerHTML) || null }), tokenKey);
    return out;
  } finally { await s.close(); }
}
module.exports = async () => {
  const off13 = await run(false, 13);
  check(!off13.login && off13.token, "switch off (owner 17.11): 13 hours without use keeps the session: " + JSON.stringify(off13));
  const on13 = await run(true, 13);
  check(on13.login && !on13.token && /12 saat/.test(on13.msg), "switch on: 13 hours → signed out, «12 saat» message: " + JSON.stringify(on13));
  const on11 = await run(true, 11);
  check(!on11.login && on11.token, "switch on: 11 hours → still signed in: " + JSON.stringify(on11));
};

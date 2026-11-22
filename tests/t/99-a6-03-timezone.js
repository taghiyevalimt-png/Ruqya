// A6-03 (audit 6, «time bombs»): the web app took Baku time as a fixed UTC+4 (var TZ = 4 h, «T20:00:00Z» as the
// start of a Baku day), while the database rules and the Android widget use the time-zone «Asia/Baku». Azerbaijan
// had summer time until 2016; if a law brings it back, the phones would count the day an hour off the database.
// Now the offset comes from the time-zone database of the phone (Intl, «Asia/Baku»), +4 only if it cannot tell.
// Also: the same «today» and week on a phone set to another time zone (a staff member travelling).
const { open, check, OWNER, seed } = require("../lib");
const head = async (p) => { await p.click('#tabs [data-tab="stats"]'); await p.click('#top [data-act="st-sec"][data-id="cweek"]'); await p.waitForTimeout(300); return (await p.textContent("#main")).replace(/\s+/g, " "); };
module.exports = async () => {
  // Friday 00:30 in Baku (+4): every phone, whatever its own zone, is on Friday 27.11 — the week 27.11–3.12
  for (const tz of ["Asia/Baku", "UTC", "Europe/Moscow", "America/New_York"]) {
    const s = await open(OWNER, { db: seed(), clock: "2026-11-26T20:30:00Z", timezoneId: tz });
    try {
      const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(1500);
      const day = await p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
      check(/Cümə, 27 noyabr/.test(day), tz + ": today is Friday 27 November: " + day.slice(0, 60));
      check((await head(p)).indexOf("27 noyabr – 3 dekabr 2026") >= 0, tz + ": «Bu həftə» 27.11–3.12");
      check(!s.errors.length, tz + ": no page errors: " + s.errors.join("; "));
    } finally { await s.close(); }
  }
  // summer time brought back (simulated: the phone's time-zone database says Baku is +5 at that moment):
  // 19:30 UTC is 00:30 on Friday in Baku, not 23:30 on Thursday
  const s = await open(OWNER, { db: seed(), clock: "2026-11-26T19:30:00Z" });
  try {
    const p = s.page;
    await p.addInitScript(() => { const D = Intl.DateTimeFormat; Intl.DateTimeFormat = function (l, o) { if (o && o.timeZone === "Asia/Baku") return { format: (d) => { const x = new Date(+d + 5 * 3600e3), z = (n) => String(n).padStart(2, "0"); return z(x.getUTCMonth() + 1) + "/" + z(x.getUTCDate()) + "/" + x.getUTCFullYear() + ", " + z(x.getUTCHours()) + ":" + z(x.getUTCMinutes()); }, resolvedOptions: () => ({ timeZone: "Asia/Baku" }) }; return new D(l, o); }; Intl.DateTimeFormat.prototype = D.prototype; Intl.DateTimeFormat.supportedLocalesOf = D.supportedLocalesOf; });
    await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(1500);
    const day = await p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
    check(/Cümə, 27 noyabr/.test(day), "with summer time in the time-zone database the app follows it: " + day.slice(0, 60));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

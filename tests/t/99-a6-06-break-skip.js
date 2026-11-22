// A6-06 (audit 6, «time bombs»): «only this day» on a repeating break adds the day to breaks.skip; the database allows
// at most 400 (CHECK ruqya_breaks_skip). The list was never trimmed: a daily break used for years would one day be
// refused with an unclear «yazılan məlumat düzgün deyil». Now days more than a year back are dropped from the list
// (they no longer matter for the calendar of work) and it never goes over 400.
const { open, check, OWNER, seed, bakuToday } = require("../lib");
module.exports = async () => {
  const db = seed(), t = bakuToday(), now = new Date().toISOString();
  const old = []; for (let i = 0; i < 400; i++) { const d = new Date(Date.UTC(2023, 0, 1) + i * 864e5); old.push(d.toISOString().slice(0, 10)); }
  db.breaks = [{ id: "d6000000-0000-4000-8000-000000000001", title: "Gündəlik", start_time: "13:00", end_time: "13:30", reader_id: null, days: [1, 2, 3, 4, 5, 6, 7], date_from: "2023-01-01", date_to: null, skip: old, mday: null, created_at: now }];
  const s = await open(OWNER, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await p.locator("#cal .brk").first().click(); await p.locator('#sheet [data-act="brk-del"]').waitFor();
    await p.click('#sheet [data-act="brk-del"]'); await p.waitForTimeout(200);
    await p.click('#sheet [data-act="brk-scope"][data-id="one"]'); await p.waitForTimeout(700);
    const b = db.breaks[0];
    check(b.skip.length <= 400, "the list of left-out days stays within the database limit of 400: " + b.skip.length);
    check(b.skip.indexOf(t) >= 0, "today is left out");
    check(!b.skip.some((d) => d < "2025-01-01"), "days more than a year back are dropped");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

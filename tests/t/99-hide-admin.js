// Owner 18.11: «I can keep sales agents out of the statistics, but not myself (admin)». An admin's own row (and other
// admins') now has «Statistikada göstərmə» too; the bookings the admin wrote then leave the sales table, «Bu gün
// yazılan qəbullar» and «Agentlər üzrə xidmətlər». Specialists do not get it (their bookings are not in sales anyway).
const { open, check, OWNER, AGENT, SPEC, seed, uuid, bakuToday, R1 } = require("../lib");
module.exports = async () => {
  const d = new Date(Date.now() + 4 * 3600e3), back = ((d.getUTCDay() - 5 + 7) % 7) + 7;
  const day = new Date(Date.now() + 4 * 3600e3 + (-back + 3) * 864e5).toISOString().slice(0, 10), wr = day + "T08:00:00Z";
  const db = seed(); db.appts = [];
  const mk = (by, time) => db.appts.push({ id: uuid(), reader_id: R1, date: day, time, duration: 30, name: "P " + time, phone: "050 " + time, price: 100, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: by, created_at: wr, updated_at: wr });
  mk(OWNER, "09:00"); mk(OWNER, "10:00"); mk(AGENT, "11:00");
  const s = await open(OWNER, { db, viewport: { width: 390, height: 844 } });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    const rows = async () => { await p.click('#tabs [data-tab="stats"]'); await p.click('#top [data-act="st-sec"][data-id="week"]'); await p.waitForTimeout(400);
      // owner 22.11: sales and «who wrote which service» are one table now (big-week); the day-by-day table has the people as columns
      return p.evaluate(() => { const t = document.querySelector('[data-st="big-week"]'), d = document.querySelector('[data-st="days-week"]');
        return [t ? [...t.querySelectorAll("tbody tr")].map((tr) => tr.children[0].textContent.trim()) : [], d ? [...d.querySelectorAll("thead th.v span")].map((x) => x.textContent.trim()) : []]; }); };
    const before = await rows();
    check(before[0].includes("Admin"), "before: the admin's bookings are in the statistics: " + JSON.stringify(before));
    await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="staff"]'); await p.waitForTimeout(300);
    await p.click('[data-act="edit-staff"][data-id="' + OWNER + '"]');
    check(await p.locator("#s-hide").count() === 1, "the admin's own row has «Statistikada göstərmə»");
    await p.locator("#s-hide").check(); await p.click('[data-act="save-staff"]'); await p.waitForTimeout(600);
    check(s.db.staff.find((x) => x.id === OWNER).hide_stats === true, "saved: hide_stats for the admin");
    const after = await rows();
    check(!after[0].includes("Admin") && after[0].includes("Nurlana"), "after: the admin is out of the statistics, the agent stays: " + JSON.stringify(after));
    // a specialist's row does not offer it
    await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="staff"]'); await p.waitForTimeout(300);
    await p.click('[data-act="edit-staff"][data-id="' + SPEC + '"]');
    check(await p.locator("#s-hide").count() === 0, "a specialist's row has no «Statistikada göstərmə»");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

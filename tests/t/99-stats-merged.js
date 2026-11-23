// Owner 22.11: «merge the statistics, not a hundred separate ones; write the column names vertically if there are
// many [owner 22.11 later: no, across]; only weekly and monthly, last week and last month — everything else inside them; money and products apart».
const { open, check, OWNER, AGENT, SPEC, seed, R1, R2, bakuToday, uuid } = require("../lib");
module.exports = async () => {
  const db = seed(), t = bakuToday(), now = new Date().toISOString();
  const mk = (by, svc, place) => ({ id: uuid(), reader_id: R1, date: t, time: "10:00", duration: 90, name: "P", phone: "0501112233", price: 100, share: 0, status: "wait", note: "", settled: false, service: svc, confirmed: false, place, follow: 0, created_by: by, created_at: now, updated_at: now });
  db.appts = [mk(AGENT, "Ruqya", "ofis"), mk(AGENT, "Hicama", "onlayn"), mk(SPEC, "Ruqya", "ofis")];
  let s = await open(OWNER, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(400);
    const secs = await p.evaluate(() => [...document.querySelectorAll('[data-act="st-sec"]')].map((b) => b.dataset.id));
    check(JSON.stringify(secs) === JSON.stringify(["today", "cweek", "week", "cmonth", "month", "prod"]), "«Bu gün» first, four periods, then products (no «Pul» since 23.11): " + secs);
    check(await p.locator(".pay.big table.big").count() === 1, "this week: one merged table (no day-by-day table)");
    const head = await p.evaluate(() => [...document.querySelectorAll('[data-st^="big-"] th.v span')].map((x) => x.textContent));
    check(["WP", "Yazdı", "Ruqya", "Hicama", "Ofis", "Onlayn"].every((x) => head.includes(x)), "requests, bookings, services and places in one table: " + head);
    check(await p.evaluate(() => getComputedStyle(document.querySelector("th.v span")).writingMode) === "horizontal-tb", "owner 22.11: column names written across again (the table scrolls sideways)");
    const rows = await p.evaluate(() => [...document.querySelectorAll('[data-st^="big-"] tbody tr')].map((r) => r.textContent.replace(/\s+/g, " ").trim()));
    check(rows.some((r) => /^Nurlana/.test(r)) && rows.some((r) => /^Əli/.test(r)), "agent and the specialist who wrote are rows: " + JSON.stringify(rows));
    // «Bu gün»: only today — sessions today and the same merged table for today
    await p.click('[data-act="st-sec"][data-id="today"]'); await p.waitForTimeout(300);
    check(await p.locator('[data-st="big-day"]').count() === 1 && await p.locator(".todaysum").count() === 1, "«Bu gün»: today's table and today's sessions");
    check(/^3/.test((await p.textContent(".todaysum")).trim()), "today: 3 sessions: " + await p.textContent(".todaysum"));
    const trow = await p.evaluate(() => [...document.querySelectorAll('[data-st="big-day"] tbody tr')].map((r) => r.textContent.replace(/\s+/g, " ").trim()));
    check(trow.some((r) => /^Nurlana/.test(r)), "today's rows: " + JSON.stringify(trow));
    await p.click('[data-act="st-sec"][data-id="cweek"]'); await p.waitForTimeout(200);
    check(await p.locator("details.rulesbox").count() === 1, "rules and terms folded inside");
    for (const id of ["week", "cmonth", "month"]) { await p.click('[data-act="st-sec"][data-id="' + id + '"]'); await p.waitForTimeout(200); check(await p.locator('[data-st^="big-"]').count() === 1, id + ": the merged table"); }
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
  s = await open(AGENT, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(400);
    const secs = await p.evaluate(() => [...document.querySelectorAll('[data-act="st-sec"]')].map((b) => b.dataset.id));
    check(!secs.includes("money") && secs.includes("prod"), "an agent has no money section, but products: " + secs);
    const rows = await p.evaluate(() => [...document.querySelectorAll('[data-st^="big-"] tbody tr')].map((r) => r.textContent.replace(/\s+/g, " ").trim()));
    check(rows.length === 1 && /^Nurlana/.test(rows[0]), "an agent sees only his own row: " + JSON.stringify(rows));
    check(!s.errors.length, "agent: no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

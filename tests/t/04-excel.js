// F-03: Excel is made for a chosen period and loads only that period and only the columns it needs.
const { open, check, OWNER, seed, bakuToday, uuid, R1, AGENT } = require("../lib");

module.exports = async () => {
  const db = seed();
  // an old booking (5 months ago) that "this month" must not download
  db.appts.push({ id: uuid(), reader_id: R1, date: bakuToday(-150), time: "11:00", duration: 60, name: "Köhnə Pasiyent", phone: "050 999 88 77", price: 100, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, created_by: AGENT, created_at: new Date(Date.now() - 150 * 864e5).toISOString(), updated_at: new Date().toISOString() });
  const s = await open(OWNER, { db });
  try {
    const p = s.page;
    await p.waitForSelector("text=Test Pasiyent", { timeout: 15000 });
    await p.waitForTimeout(3200);
    await p.click('#tabs [data-tab="stats"]');
    await p.click('[data-act="xls"]');
    await p.waitForSelector('[data-act="xls-per"]');
    check((await p.locator('[data-act="xls-per"]').count()) === 4, "four period choices");
    s.ctl.log.length = 0;
    await p.click('[data-act="xls-per"][data-id="m1"]');
    await p.waitForSelector("a[download]", { timeout: 15000 });
    const q = s.ctl.log.filter((l) => /^GET \/rest\/v1\/appts/.test(l));
    check(q.length && q.every((l) => /date=gte\.|created_at=gte\./.test(l)), "appts asked only from a start date: " + q.join(" | "));
    check(q.every((l) => !/select=\*/.test(l)), "only the needed columns");
    const hint = await p.textContent("#sheet");
    check(/1 qəbul/.test(hint), "this month has 1 booking, the old one is left out: " + hint);
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click("a[download]")]);
    const b = require("fs").readFileSync(await dl.path());
    const sig = [b[0], b[1], b.length, dl.suggestedFilename()];
    check(sig[0] === 0x50 && sig[1] === 0x4b && sig[2] > 1000, "a real xlsx (zip) file");
    check(/m1-/.test(sig[3]), "file name says the period: " + sig[3]);
    // all (2 years): the old booking is in
    await p.click('[data-act="close"]');
    await p.click('[data-act="xls"]');
    await p.click('[data-act="xls-per"][data-id="all"]');
    await p.waitForSelector("a[download]", { timeout: 15000 });
    check(/2 qəbul/.test(await p.textContent("#sheet")), "2 years include the old booking");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

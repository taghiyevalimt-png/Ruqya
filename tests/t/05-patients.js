// F-04: the patients list gets old visits grouped by patient (one row each), the visits of one patient only on its card.
const { open, check, AGENT, seed, bakuToday, uuid, R1 } = require("../lib");

function old(db, days, name, phone, status) {
  db.appts.push({ id: uuid(), reader_id: R1, date: bakuToday(-days), time: "12:00", duration: 60, name, phone, price: 120, share: 0, status: status || "wait", note: "", settled: false, service: "Ruqya", confirmed: false, created_by: AGENT, created_at: new Date(Date.now() - days * 864e5).toISOString(), updated_at: new Date().toISOString() });
}

async function run(noRpc) {
  const db = seed();
  old(db, 100, "Test Pasiyent", "+994 50 111 22 33");      // same person as today's booking, other phone format
  old(db, 120, "Test Pasiyent", "050 111 22 33", "noshow");
  for (let i = 0; i < 30; i++) old(db, 200 + i, "Köhnə Xəstə", "055 777 66 55");
  const s = await open(AGENT, { db });
  s.ctl.noRpc = noRpc;
  try {
    const p = s.page;
    await p.waitForSelector("text=Test Pasiyent", { timeout: 15000 });
    await p.waitForTimeout(3200);
    s.ctl.log.length = 0;
    await p.click('#tabs [data-tab="patients"]');
    await p.waitForSelector("#plist >> text=Köhnə Xəstə", { timeout: 10000 });
    const big = s.ctl.log.filter((l) => /^GET \/rest\/v1\/appts/.test(l) && /date=lt\./.test(l));
    if (!noRpc) check(!big.length, "old visits are not downloaded one by one: " + big.join(" | "));
    else check(big.length === 1, "without the SQL file the old way still works");
    const row = await p.textContent("#plist");
    check(/Köhnə Xəstə[\s\S]*30 dəfə gəlib/.test(row), "old-only patient counted: " + row.slice(0, 300));
    check(/Test Pasiyent[\s\S]*[12] dəfə gəlib[\s\S]*gəlməyib: 1/.test(row), "recent and old visits of one patient are joined: " + row.slice(0, 300));
    await p.click("#plist >> text=Köhnə Xəstə");
    await p.waitForSelector(".pvisit", { timeout: 10000 });
    await p.waitForTimeout(500);
    check((await p.locator(".pvisit").count()) === 30, "card shows the old visits");
    check(/cəmi|Köhnə qəbul/.test(await p.textContent("#sheet")), "old visits are view-only");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
}

module.exports = async () => { await run(false); await run(true); };

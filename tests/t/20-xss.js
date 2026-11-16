// T-35: markup typed into any field (patient name, phone, note, staff name, specialist name, product names,
// expense title, break title) is shown as text on every screen and never runs (also with the CSP switched off,
// so the escaping itself is tested, not only the CSP).
const { open, check, OWNER, seed, uuid, bakuToday, R1 } = require("../lib");
const P = [`<img src=x onerror="window.__xss=1">`, `"><svg onload=window.__xss=2>`, `'><script>window.__xss=3</script>`, `javascript:window.__xss=4`, `{{constructor.constructor('window.__xss=5')()}}`];
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  P.forEach((x, i) => db.appts.push({ id: uuid(), reader_id: R1, date: bakuToday(0), time: String(14 + i).padStart(2, "0") + ":00", duration: 30, name: x, phone: x, price: 130, share: 0, status: i % 2 ? "cancel" : "wait", note: x, settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 1, created_by: db.staff[1].id, created_at: now, updated_at: now }));
  db.staff[1].name = P[0]; db.readers[1].name = P[1];
  db.product_sales.push({ id: uuid(), date: bakuToday(0), amount: 5, names: P.join("\n"), created_by: db.staff[0].id, created_at: now });
  db.expenses.push({ id: uuid(), date: bakuToday(0), title: P[2], amount: 5, created_by: db.staff[0].id, created_at: now });
  db.breaks.push({ id: uuid(), title: P[0], start_time: "21:00", end_time: "21:30", reader_id: null, created_at: now });
  db.audit_log = [{ id: 7, at: now, uid: db.staff[1].id, tbl: "appts", op: "DELETE", row_id: uuid(), old: { name: P[0], note: P[2], date: bakuToday(0), time: "10:00" }, new: null }];
  const s = await open(OWNER, { db, bypassCSP: true });
  try {
    const p = s.page; let dialogs = 0; p.on("dialog", (d) => { dialogs++; d.dismiss().catch(() => {}); });
    await p.waitForSelector("#tabs:not([hidden])", { timeout: 15000 }); await p.waitForTimeout(3300);
    const visit = [
      async () => { await p.click('[data-act="view"][data-id="grid"]').catch(() => {}); },
      async () => { await p.click("#cal .ev >> nth=1"); await p.waitForTimeout(300); await p.click('[data-act="close"]').catch(() => {}); },
      async () => { await p.click('[data-act="view"][data-id="list"]'); },
      async () => { await p.click('#tabs [data-tab="stats"]'); for (const sec of ["today", "day", "week", "month"]) { await p.click('#top [data-act="st-sec"][data-id="' + sec + '"]').catch(() => {}); await p.waitForTimeout(150); } },
      async () => { await p.click('#tabs [data-tab="cash"]'); },
      async () => { await p.click('#tabs [data-tab="patients"]'); await p.click("#plist [data-act=patient]"); await p.waitForTimeout(300); await p.click('[data-act="close"]').catch(() => {}); await p.click('[data-act="p-sec"][data-id="cancel"]'); },
      async () => { await p.click('#tabs [data-tab="readers"]'); for (const sec of ["spec", "breaks", "staff"]) { await p.click('#top [data-act="set-sec"][data-id="' + sec + '"]').catch(() => {}); await p.waitForTimeout(150); } await p.click('[data-act="audit"]').catch(() => {}); await p.waitForTimeout(500); },
    ];
    for (const v of visit) { await v(); await p.waitForTimeout(300); }
    const r = await p.evaluate(() => ({ xss: window.__xss, imgs: document.querySelectorAll('img[src="x"]').length, svg: document.querySelectorAll("svg[onload]").length, scripts: [...document.querySelectorAll("script")].filter((x) => /__xss/.test(x.textContent)).length }));
    check(r.xss === undefined && !r.imgs && !r.svg && !r.scripts && !dialogs, "no injected markup ran or became an element: " + JSON.stringify(r));
    check((await p.textContent("body")).includes("onerror"), "the payload is shown as text");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

// Owner 18.11: «Neçə satış agenti neçə xidmət yazıb, bu da statistikalarda göstərməlidir» — statistics (Gündəlik, Həftəlik,
// Aylıq — where «Xidmətlər» is) show, per person who wrote bookings, how many of each service. Counted like the «Xidmətlər» table (cancelled
// and no-show bookings not counted); an admin sees every agent, an agent only their own row; Russian labels.
const { open, check, OWNER, AGENT, seed, uuid, bakuToday, R1, R2 } = require("../lib");
module.exports = async () => {
  // the periods the statistics show by default: the last finished week and month (Friday–Thursday blocks), taken from
  // the app itself; the same bookings are put at the end of each (once if the week lies inside the month)
  let s0 = await open(OWNER), R;
  const AZ = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
  const range = async (sec) => { const p = s0.page; await p.click('#top [data-act="st-sec"][data-id="' + sec + '"]'); await p.waitForTimeout(400);
    const t = (await p.evaluate(() => document.querySelector("#main .daynav .label").firstChild.textContent)).toLowerCase();
    const m = [...t.matchAll(/(\d{1,2}) ([a-zəıöüçşğ]+)(?: (\d{4}))?/g)], yr = +(t.match(/\d{4}/) || [new Date().getFullYear()])[0];
    const iso = (x) => yr + "-" + String(AZ.indexOf(x[2]) + 1).padStart(2, "0") + "-" + x[1].padStart(2, "0");
    return { s: iso(m[0]), end: iso(m[m.length - 1]) }; };
  try { await s0.page.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await s0.page.waitForTimeout(3300); await s0.page.click('#tabs [data-tab="stats"]');
    R = { w: await range("week"), m: await range("month"), today: bakuToday(0) }; } finally { await s0.close(); }
  const dates = [R.w.end]; if (!(R.w.end >= R.m.s && R.w.end <= R.m.end)) dates.push(R.m.end);
  const back = Math.round((new Date(R.today + "T12:00:00Z") - new Date(R.w.end + "T12:00:00Z")) / 864e5);
  const db = seed(), now = new Date().toISOString(), A2 = uuid();
  db.appts = [];
  db.staff.push({ id: A2, name: "Asiya", role: "agent", want: null, created_at: now });
  const mk = (by, svc, time, status = "wait", rid = R1) => dates.forEach((day) => db.appts.push({ id: uuid(), reader_id: rid, date: day, time, duration: 30, name: "P " + time, phone: "050 " + time, price: 130, share: 0, status, note: "", settled: false, service: svc, confirmed: false, place: "ofis", follow: 0, created_by: by, created_at: now, updated_at: now }));
  // Nurlana: 3 Ruqya + 1 Hicama (+ 1 cancelled Ruqya, not counted); Asiya: 2 Ruqya + 2 Masaj
  mk(AGENT, "Ruqya", "09:00"); mk(AGENT, "Ruqya", "10:00"); mk(AGENT, "Ruqya", "11:00"); mk(AGENT, "Hicama", "12:00"); mk(AGENT, "Ruqya", "13:00", "cancel");
  mk(A2, "Ruqya", "09:00", "wait", R2); mk(A2, "Ruqya", "10:00", "wait", R2); mk(A2, "Masaj", "11:00", "wait", R2); mk(A2, "Masaj", "12:00", "wait", R2);
  const read = (p) => p.evaluate(() => {
    const t = document.querySelector('[data-st="svc-agents"]'); if (!t) return null;
    const head = [...t.querySelectorAll("thead th")].map((x) => x.textContent.trim());
    const rows = [...t.querySelectorAll("tbody tr, tfoot tr")].map((tr) => [...tr.children].map((x) => x.textContent.trim()));
    return { title: t.querySelector(".head b").textContent.trim(), head, rows, wide: t.scrollWidth - t.clientWidth };
  });
  const cell = (r, who, col) => { const row = r.rows.find((x) => x[0] === who); const i = r.head.indexOf(col); return row && i >= 0 ? row[i] : undefined; };
  let s = await open(OWNER, { db, viewport: { width: 390, height: 844 } });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.click('#tabs [data-tab="stats"]');
    for (const sec of ["day", "week", "month"]) {
      await p.click('#top [data-act="st-sec"][data-id="' + sec + '"]'); await p.waitForTimeout(400);
      if (sec === "day") for (let k = 0; k < back; k++) { await p.click('[data-act="st-all"][data-n="-1"]'); await p.waitForTimeout(250); }
      const r = await read(p);
      check(r, sec + ": the table «Agentlər üzrə xidmətlər» is shown");
      if (!r) continue;
      check(r.title === "Agentlər üzrə xidmətlər", sec + ": title: " + r.title);
      check(JSON.stringify(r.head) === JSON.stringify(["Agent", "Ruqya", "Hicama", "Masaj", "Cəmi"]), sec + ": columns are the services written in the period: " + JSON.stringify(r.head));
      check(cell(r, "Nurlana", "Ruqya") === "3" && cell(r, "Nurlana", "Hicama") === "1" && cell(r, "Nurlana", "Masaj") === "0" && cell(r, "Nurlana", "Cəmi") === "4", sec + ": Nurlana 3 Ruqya, 1 Hicama, total 4 (cancelled not counted): " + JSON.stringify(r.rows));
      check(cell(r, "Asiya", "Ruqya") === "2" && cell(r, "Asiya", "Masaj") === "2" && cell(r, "Asiya", "Cəmi") === "4", sec + ": Asiya 2 Ruqya, 2 Masaj: " + JSON.stringify(r.rows));
      check(cell(r, "Cəmi", "Ruqya") === "5" && cell(r, "Cəmi", "Cəmi") === "8", sec + ": totals row: " + JSON.stringify(r.rows));
      check(r.wide <= 1, sec + ": fits the phone width (390 px)");
    }
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
  // an agent sees only their own row
  s = await open(AGENT, { db, viewport: { width: 390, height: 844 } });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.click('#tabs [data-tab="stats"]'); await p.click('#top [data-act="st-sec"][data-id="week"]'); await p.waitForTimeout(400);
    const r = await read(p);
    check(r && r.rows.some((x) => x[0] === "Nurlana") && !r.rows.some((x) => x[0] === "Asiya"), "agent: only own row: " + JSON.stringify(r && r.rows));
    await p.evaluate(() => localStorage.setItem("ruqya.lang", "ru")); await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.click('#tabs [data-tab="stats"]'); await p.click('#top [data-act="st-sec"][data-id="week"]'); await p.waitForTimeout(400);
    const ru = await read(p);
    check(ru && ru.title === "Услуги по агентам" && ru.head[0] === "Агент" && ru.head[ru.head.length - 1] === "Итого", "Russian labels: " + JSON.stringify(ru && [ru.title, ru.head]));
    check(!s.errors.length, "agent: no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

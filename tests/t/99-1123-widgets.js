// Owner 23.11: two new widgets, «gündəlik» and «həftəlik». The app hands the widgets the start time and the specialist
// of every booking (more names for the near days); Ayarlar → Görünüş has a button for each widget; a phone with the old
// app (no pinWidgetOf) is told to install the new one for day / week, the month still works.
const { open, check, OWNER, R1, R2, seed, bakuToday, uuid } = require("../lib");
const bridge = (withNew) => {
  window.__w = { data: [], pins: [] };
  window.RuqyaApp = { setWidgetData: (j) => window.__w.data.push(j), pinWidget: () => { window.__w.pins.push("old"); return true; } };
  if (withNew) window.RuqyaApp.pinWidgetOf = (k) => { window.__w.pins.push(k); return true; };
};
module.exports = async () => {
  const db = seed(), t = bakuToday(), now = new Date().toISOString();
  db.appts = [];
  for (let i = 0; i < 9; i++) db.appts.push({ id: uuid(), reader_id: i % 2 ? R1 : R2, date: t, time: String(9 + i).padStart(2, "0") + ":00", duration: 60, name: "Pasiyent " + i, phone: "050 00" + i, price: 100, share: 0, status: i === 3 ? "cancel" : "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: OWNER, created_at: now, updated_at: now });
  let s = await open(OWNER, { db, init: [bridge, true] });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3500);
    const last = await p.evaluate(() => window.__w.data[window.__w.data.length - 1]);
    check(last, "data handed to the widgets");
    const d = JSON.parse(last), items = d.d[t];
    check(items && items.length === 8, "all 8 not-cancelled bookings of today are sent (was at most 4): " + (items && items.length));
    check(items[0][4] === 9 * 60 && items[0][3] === 10 * 60 && items[0][5] === "İlkin", "start minute, end minute and specialist: " + JSON.stringify(items[0]));
    check(d.n[t] === 8, "the day's total: " + d.n[t]);
    await p.click('#tabs [data-tab="readers"]'); await p.click('[data-act="set-sec"][data-id="view"]'); await p.waitForTimeout(300);
    const btns = await p.evaluate(() => [...document.querySelectorAll('[data-act="widget"]')].map((b) => b.dataset.id + ":" + b.textContent.trim()));
    check(btns.join("|") === "day:+ Gündəlik vidcet|week:+ Həftəlik vidcet|month:+ Aylıq vidcet", "three widget buttons: " + btns);
    for (const k of ["day", "week", "month"]) { await p.click('[data-act="widget"][data-id="' + k + '"]'); await p.waitForTimeout(200); }
    check(JSON.stringify(await p.evaluate(() => window.__w.pins)) === '["day","week","month"]', "each button asks for its own widget");
    await p.screenshot({ path: require("path").join(__dirname, "..", "out", "widgets-settings.png") });
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
  // the old app (no pinWidgetOf): day / week say «install the new version», the month uses the old call
  s = await open(OWNER, { db, init: [bridge, false], lang: "ru" });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await p.click('#tabs [data-tab="readers"]'); await p.click('[data-act="set-sec"][data-id="view"]'); await p.waitForTimeout(300);
    check(/Виджет на день/.test(await p.textContent("#main")), "Russian labels");
    await p.click('[data-act="widget"][data-id="day"]'); await p.waitForTimeout(300);
    check(/новая версия приложения/.test(await p.textContent("body")), "old app: asked to install the new one");
    await p.click('[data-act="widget"][data-id="month"]'); await p.waitForTimeout(200);
    check(JSON.stringify(await p.evaluate(() => window.__w.pins)) === '["old"]', "old app: the month widget still placed: " + JSON.stringify(await p.evaluate(() => window.__w.pins)));
    check(!s.errors.length, "no page errors (old app): " + s.errors.join("; "));
  } finally { await s.close(); }
};

// Random taps and typing everywhere, for every role and both languages: the page must never throw.
const { open, check, OWNER, AGENT, SPEC, seed, uuid, bakuToday, R1, R2 } = require("../lib");

function richDb() {
  const db = seed(), now = new Date().toISOString();
  const add = (d, t, r, st, by, name, phone) => db.appts.push({ id: uuid(), reader_id: r, date: bakuToday(d), time: t, duration: 60, name, phone, price: 130, share: 0, status: st, note: "qeyd", settled: false, service: "Ruqya", confirmed: false, place: "ofis", created_by: by, created_at: now, updated_at: now });
  add(0, "12:00", R1, "cancel", AGENT, "Ləğv Olan", "055 111 11 11");
  add(0, "12:00", R1, "wait", AGENT, "Yerinə Gələn", "yalnız WhatsApp");
  add(-1, "15:00", R2, "wait", SPEC, "Dünən", "050 333 44 55");
  add(1, "09:00", R2, "wait", OWNER, "Sabah", "+7 912 345 67 89");
  db.product_sales.push({ id: uuid(), date: bakuToday(0), amount: 25, names: "Yağ\nBal", created_by: AGENT, created_at: now });
  db.expenses.push({ id: uuid(), date: bakuToday(0), title: "Su", amount: 5, created_by: OWNER, created_at: now });
  db.breaks.push({ id: uuid(), title: "Namaz", start_time: "13:00", end_time: "13:30", reader_id: null, created_at: now });
  return db;
}
const SKIP = /^(logout|reload|anon|xls-save)$/;
const t0 = Date.now();
function rnd(n) { return Math.floor(Math.random() * n); }

async function fuzz(who, lang, steps) {
  const s = await open(who, { lang, db: richDb() });
  try {
    const p = s.page;
    await p.waitForSelector("#tabs:not([hidden])", { timeout: 15000 });
    await p.waitForTimeout(3300);
    p.on("dialog", (d) => d.dismiss().catch(() => {}));
    p.setDefaultTimeout(1500);   // a covered button is skipped, not waited for
    s.context.on("page", (np) => np.close().catch(() => {}));   // WhatsApp / phone links open new windows
    await s.context.route(/^(?!http:\/\/127\.0\.0\.1|https:\/\/ldkhdeehrrajvgrtieal)/, (r) => r.abort()).catch(() => {});
    for (let i = 0; i < steps; i++) {
      const r = Math.random();
      if (r < 0.12) { await p.click('#tabs button:not([hidden]) >> nth=' + rnd(4)).catch(() => {}); continue; }
      if (r < 0.22) {
        const inputs = await p.$$('#sheet input[type="text"]:visible, #sheet textarea:visible, #q');
        if (inputs.length) await inputs[rnd(inputs.length)].fill(["", "Əli İsmayıl", "12,5", "abc", "050 123 45 67", "<b>x</b>", "9".repeat(20)][rnd(7)]).catch(() => {});
        continue;
      }
      if (r < 0.26) { await p.evaluate(() => { if (history.state && history.state.sheet) history.back(); }).catch(() => {}); continue; }   // the phone's back button, only inside the app
      const n = await p.evaluate((skip) => {
        const els = [...document.querySelectorAll("[data-act]")].filter((e) => e.offsetParent !== null && !e.disabled && !new RegExp(skip).test(e.dataset.act));
        if (!els.length) return 0;
        els[Math.floor(Math.random() * els.length)].click(); return els.length;
      }, SKIP.source).catch(() => 0);
      await p.waitForTimeout(40);
    }
    console.log("    fuzz", who.slice(0, 4), lang || "az", steps, "steps", ((Date.now() - t0) / 1000).toFixed(0) + "s");
    check(!s.errors.length, `${who.slice(0, 4)} ${lang || "az"}: page errors after ${steps} random steps: ` + s.errors.slice(0, 3).join("; "));
  } finally { await s.close(); }
}

module.exports = async () => {
  const n = +process.env.FUZZ || 120;
  for (const who of [OWNER, AGENT, SPEC]) for (const lang of ["", "ru"]) await fuzz(who, lang, n);
};

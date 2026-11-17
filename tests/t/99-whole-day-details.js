// Owner 18.11 (screenshot 15:47): in «Bütün gün» blocks with only the name look empty. Under the name add the time,
// the phone, then «Yazdı:» on its own line and the agent's name under it — only what fits the block wholly, in that
// order: name; name + time; name + time + phone; name + time + phone + Yazdı/agent. The letters of these lines are
// sized so a 10-character phone (0101111111) fits the block's width. Checked at 390 and 360 px wide.
const { open, check, OWNER, AGENT, seed, uuid, bakuToday } = require("../lib");
module.exports = async () => {
  for (const [w, h] of [[390, 844], [360, 740]]) {
    const db = seed(), now = new Date().toISOString();
    db.appts = [];
    while (db.readers.length < 7) db.readers.push({ id: uuid(), name: "M" + db.readers.length, price: 0, share: 0, archived: false, color: null, created_at: "2026-11-03T00:00:00Z" });
    // long (2 h), medium (1 h), short (30 min) blocks
    const rows = [[0, "09:00", 120, "Terane"], [1, "12:00", 60, "Aysen"], [2, "15:00", 30, "Rəşid"], [3, "17:00", 90, "Leyla Məmmədova"]];
    for (const [ri, t, d, n] of rows) db.appts.push({ id: uuid(), reader_id: db.readers[ri].id, date: bakuToday(0), time: t, duration: d, name: n, phone: "0101111111", price: 130, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: AGENT, created_at: now, updated_at: now });
    const s = await open(OWNER, { db, viewport: { width: w, height: h } });
    try {
      const p = s.page;
      await p.evaluate(() => localStorage.setItem("ruqya.fit", "1")); await p.reload();
      await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
      const evs = await p.evaluate(() => [...document.querySelectorAll("#cal .ev")].map((e) => {
        const er = e.getBoundingClientRect();
        const vis = [...e.children].filter((c) => getComputedStyle(c).display !== "none").map((c) => { const r = c.getBoundingClientRect(); return { t: c.textContent, inside: r.bottom <= er.bottom - 1 + 0.5 && r.right <= er.right + 0.5, oneLine: c.scrollWidth <= c.clientWidth + 1, fs: parseFloat(getComputedStyle(c).fontSize) }; });
        return { name: e.firstElementChild.textContent, h: Math.round(er.height), vis };
      }));
      const by = (n) => evs.find((e) => e.name === n);
      const order = ["name", "time", "phone", "Yazdı:", "agent"];
      for (const e of evs) {
        const want = [e.name, rows.find((r) => r[3] === e.name)[1], "0101111111", "Yazdı:", "Nurlana"];
        const got = e.vis.map((v) => v.t);
        check(JSON.stringify(got) === JSON.stringify(want.slice(0, got.length)) && got.length !== 4, w + " " + e.name + ": the lines in order, only whole steps (" + order.slice(0, got.length).join(", ") + "): " + JSON.stringify(got));
        check(e.vis.every((v) => v.inside), w + " " + e.name + ": every shown line is fully inside the block (" + e.h + " px): " + JSON.stringify(e.vis));
        const ph = e.vis.find((v) => v.t === "0101111111");
        if (ph) check(ph.oneLine, w + " " + e.name + ": the 10-character phone fits the width: " + JSON.stringify(ph));
      }
      check(by("Terane").vis.length === 5, w + ": the 2-hour block shows everything: " + JSON.stringify(by("Terane").vis.map((v) => v.t)));
      check(by("Rəşid").vis.length <= 2, w + ": the 30-minute block shows only what fits (name, maybe time): " + JSON.stringify(by("Rəşid").vis.map((v) => v.t)));
      check(by("Aysen").vis.length >= 2, w + ": the 1-hour block shows more than the name: " + JSON.stringify(by("Aysen").vis.map((v) => v.t)));
      check(!s.errors.length, w + ": no page errors: " + s.errors.join("; "));
    } finally { await s.close(); }
  }
};

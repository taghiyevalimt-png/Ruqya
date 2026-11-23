// Owner 24.11 (screenshot 00:04): in «Bütün gün» the blocks show only the patients' names; the ✅✅ never cover a name;
// a narrow but long block writes the name from top to bottom. Checked on a busy day like the screenshot (7 specialists,
// overlapping bookings in one column), at 390 and 360 px wide, light and dark:
//   no phone, no agent's name in a block; the ✅ line lies below the name, not over it; the whole name is visible
//   (nothing cut, no «…»); no word broken in the middle; narrow tall blocks are written top to bottom.
// (99-whole-day-details.js — phone and agent under the name, owner 18.11 — is replaced by this.)
const { open, check, OWNER, AGENT, seed, uuid, bakuToday } = require("../lib");
module.exports = async () => {
  const pats = ["Ləman Əliyeva", "Məhliqa", "Rafael", "Ruslan", "Sabina", "Mürsəl", "Nigar", "Səbinə", "Abbas", "Orxan", "Elçin", "Kamran", "Ramil", "Turan", "Vüsal", "Seyfəddin", "Hafiz", "Babək", "Simuzər", "Türkan", "Elşən", "Elmira", "Firəngiz", "Ayxan", "Pasiyent", "Xədicə", "Cəmilə"];
  const ev = [[0, "11:00", 120], [1, "11:00", 90], [0, "14:00", 90], [0, "16:00", 120], [0, "18:00", 120], [1, "10:30", 90], [1, "13:00", 90], [1, "14:30", 90], [1, "16:00", 90], [1, "17:30", 90], [1, "19:00", 90], [1, "20:30", 90], [1, "18:30", 60], [2, "09:00", 90], [2, "11:00", 90], [2, "13:00", 90], [2, "14:30", 90], [2, "16:30", 90], [2, "18:00", 30], [2, "20:00", 90], [3, "18:00", 90], [4, "11:30", 90], [4, "13:00", 90], [4, "18:00", 90], [5, "10:00", 60], [5, "11:00", 60], [5, "13:00", 60], [6, "11:00", 60], [6, "16:00", 60]];
  for (const [w, theme] of [[390, "dark"], [360, "light"]]) {
    const db = seed(), t = bakuToday(), now = new Date().toISOString();
    db.readers = ["İlkin", "Əli", "Logman", "Zeyd", "Rizvan", "Ruhanə", "Aqşin"].map((n, i) => ({ id: "aaaaaaaa-0000-4000-8000-0000000003" + String(i).padStart(2, "0"), name: n, archived: false, created_at: "2026-11-0" + (i + 1) + "T00:00:00Z", color: "", price: 0, share: 0 }));
    db.appts = ev.map(([r, time, d], i) => ({ id: uuid(), reader_id: db.readers[r].id, date: t, time, duration: d, name: pats[i % pats.length], phone: "+994 55 735 27 47", price: 0, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: i % 3 !== 2, place: "ofis", follow: 0, created_by: AGENT, created_at: now, updated_at: now }));
    const s = await open(OWNER, { db, viewport: { width: w, height: 844 }, init: [(th) => { localStorage.setItem("ruqya.fit", "1"); localStorage.setItem("ruqya.view18", "1"); localStorage.setItem("ruqya.theme", th); }, theme] });
    try {
      const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
      await p.click('#tabs [data-tab="day"]'); await p.waitForTimeout(1200);
      const m = await p.evaluate(() => [...document.querySelectorAll("#cal.fit .ev")].map((e) => {
        const b = e.querySelector("b.nm"), ok = e.querySelector(".okm"), er = e.getBoundingClientRect(), br = b ? b.getBoundingClientRect() : null, or = ok ? ok.getBoundingClientRect() : null;
        // the text's real box (a Range), to see it inside the block and not under the ✅
        const rg = document.createRange(); if (b) rg.selectNodeContents(b); const tr = b ? rg.getBoundingClientRect() : null;
        const vert = getComputedStyle(b).writingMode.indexOf("vertical") === 0;
        return { name: b && b.textContent, text: e.textContent, kids: e.children.length, w: er.width, h: er.height, vert, fs: parseFloat(getComputedStyle(b).fontSize),
          inside: tr && tr.left >= er.left - 0.5 && tr.right <= er.right + 0.5 && tr.top >= er.top - 0.5 && tr.bottom <= er.bottom + 0.5,
          over: !!(or && tr && or.width && !(or.top >= tr.bottom - 0.5 || or.bottom <= tr.top + 0.5 || or.left >= tr.right - 0.5 || or.right <= tr.left + 0.5)),
          cut: b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1, broken: /anywhere|break-all/.test(getComputedStyle(b).overflowWrap + getComputedStyle(b).wordBreak),
          lines: vert ? Math.round(tr.width / (parseFloat(getComputedStyle(b).fontSize) * 1.08)) : Math.round(tr.height / (parseFloat(getComputedStyle(b).fontSize) * 1.08)) };
      }));
      const ww = w + "/" + theme + ": ";
      check(m.length === ev.length, ww + "all blocks drawn: " + m.length);
      for (const e of m) {
        check(!/\+994|Nurlana/.test(e.text), ww + e.name + ": only the name (no phone, no agent): " + JSON.stringify(e.text));
        check(e.inside && !e.cut, ww + e.name + ": the whole name is visible inside the block: " + JSON.stringify(e));
        check(!e.over, ww + e.name + ": the ✅ do not cover the name: " + JSON.stringify(e));
        check(!e.broken, ww + e.name + ": no word broken in the middle: " + JSON.stringify(e));
        // a one-word name stays on one line (or one column when written top to bottom)
        if (!/\s/.test(e.name)) check(e.lines <= 1, ww + e.name + ": one word = one line: " + JSON.stringify(e));
      }
      const narrow = m.filter((e) => e.w < 24 && e.h > 45);
      check(narrow.length >= 4 && narrow.every((e) => e.vert), ww + "narrow tall blocks are written top to bottom: " + JSON.stringify(narrow.map((e) => [e.name, Math.round(e.w), Math.round(e.h), e.vert])));
      check(m.filter((e) => e.w > 30).every((e) => !e.vert && e.fs >= 6.5) && m.filter((e) => e.w > 30 && e.h > 30 && e.name.length <= 7).every((e) => e.fs >= 8.5), ww + "wide blocks: across; a name of up to 7 letters ≥ 8.5 px: " + JSON.stringify(m.filter((e) => e.w > 30 && (e.vert || e.fs < 8.5)).map((e) => [e.name, e.fs])));
      check(!s.errors.length, ww + "no page errors: " + s.errors.join("; "));
    } finally { await s.close(); }
  }
};

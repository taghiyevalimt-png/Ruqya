// 24.11 (found by the whole suite at 16:41): in «Bütün gün» a short block (30 min, 36×16 px at 360 wide) of a session
// that is over shows ✅✅ beside the name; the app guessed them 14 px wide (they were 20), and «Orxan» was cut. Now the ✅
// are measured, made smaller, or step aside — the name is never cut. The same day as 99-whole-day-names, but yesterday,
// so every block has its ✅✅ whatever the time the test runs.
// Owner 17.11 (screenshot 14:33, 10 specialists): in «Bütün gün» 10 columns on one screen is too many — at most 7
// across the screen, the rest sideways. Blocks show only the patient's name, the whole name, line under line, with
// letters big enough that a 7-letter name fits one line of the block. Checked at 390 and 360 px wide.
const { open, check, OWNER, AGENT, seed, uuid, bakuToday, goDay } = require("../lib");
module.exports = async () => {
  for (const [w, h] of [[390, 844], [360, 740]]) {
    const db = seed(), now = new Date().toISOString();
    // the centre's real specialists (owner 18.11 uses one letter size for all names at the bottom, so a made-up 12-letter
    // name like «Mütəxəssis 2» would end in «…» in a 42 px column — see AUDIT_LOG F-07)
    for (const n of ["Logman", "Zeyd", "Rizvan", "Ruhanə", "Aqşin", "Təranə", "Dr. Günel", "Psixoloq"]) db.readers.push({ id: uuid(), name: n, price: 0, share: 0, archived: false, color: null, created_at: "2026-11-03T00:00:00Z" });
    const names = ["Rəşidov", "Leyla Məmmədova", "Səbinə Hüseynova Əliqızı", "Orxan"];
    const rows = [[4, "10:00", 90, names[0]], [5, "12:00", 60, names[1]], [2, "14:00", 90, names[2]], [3, "16:00", 30, names[3]], [9, "18:00", 60, names[0]]];   // columns without other bookings (two at one time share a column)
    for (const [ri, t, d, n] of rows) db.appts.push({ id: uuid(), reader_id: db.readers[ri].id, date: bakuToday(-1), time: t, duration: d, name: n, phone: "050 000 00 1" + ri, price: 130, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: true, place: "ofis", follow: 0, created_by: AGENT, created_at: now, updated_at: now });
    const s = await open(OWNER, { db, viewport: { width: w, height: h } });
    try {
      const p = s.page;
      await p.evaluate(() => localStorage.setItem("ruqya.fit", "1")); await p.reload();
      await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
      await goDay(p, bakuToday(-1)); await p.waitForTimeout(1200);   // yesterday: every session is over — each block has its ✅✅
      const m = await p.evaluate(() => {
        const cal = document.getElementById("cal"), cr = cal.getBoundingClientRect();
        const cols = [...cal.querySelectorAll(".col")].map((c) => c.getBoundingClientRect());
        const onScreen = cols.filter((c) => c.left >= cr.left - 1 && c.right <= cr.right + 1).length;
        const evs = [...cal.querySelectorAll(".ev")].map((e) => { const b = e.firstElementChild, bs = getComputedStyle(b), fs = parseFloat(bs.fontSize), lh = parseFloat(bs.lineHeight) || fs;
          return { text: e.textContent, children: e.children.length, bText: [...b.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(""), fs, lines: (() => { const rg = document.createRange(); rg.selectNodeContents(b); return Math.round(rg.getBoundingClientRect().height / (fs * 1.08)); })(),   /* the ✅ line not counted (owner 18.11) */ clipped: b.scrollHeight > e.clientHeight - 2 || b.scrollWidth > b.clientWidth + 1 || b.getBoundingClientRect().bottom > e.getBoundingClientRect().bottom + 1, ell: bs.textOverflow }; });
        const pills = [...cal.querySelectorAll(".cal-foot .fn span")].filter((x) => x.getBoundingClientRect().right <= cr.right + 1).map((x) => ({ t: x.textContent, cut: x.scrollWidth > x.clientWidth + 1 }));
        return { pills, hour: getComputedStyle(cal.querySelector(".col")).backgroundSize, n: cols.length, onScreen, colW: Math.round(cols[0].width), sideways: cal.scrollWidth > cal.clientWidth + 1, evs };
      });
      check(m.n === 10, w + ": 10 columns: " + m.n);
      check(m.onScreen === 7, w + ": exactly 7 specialists across the screen: " + m.onScreen + " (column " + m.colW + " px)");
      check(m.sideways, w + ": the other 3 are reached sideways");
      check(m.pills.length >= 7 && m.pills.every((x) => !x.cut), w + ": specialists' names at the bottom are not cut: " + JSON.stringify(m.pills));
      const ours = m.evs.filter((e) => names.includes(e.bText));
      check(ours.length === 5, w + ": our 5 blocks drawn with whole names: " + m.evs.map((e) => e.bText).join(" | "));
      for (const e of m.evs) {
        // owner 18.11: under the name, the time, phone and who wrote it where there is room (test 99-whole-day-details)
        check(e.text.replace(/^[✅✓✗\s]+/, "").startsWith(e.bText), w + ": the name comes first in the block: " + JSON.stringify(e.text));
        check(!e.clipped && e.ell !== "ellipsis", w + ": the name is fully visible inside its block: " + JSON.stringify(e));
      }
      // owner 18.11: the name a little bigger, a 7-letter name still on one line (was 8 px at 390 px wide)
      if (w === 390) check(m.evs.filter((e) => e.bText === "Rəşidov").every((e) => e.fs >= 8.5), w + ": the name is bigger than before (≥ 8.5 px): " + m.evs.filter((e) => e.bText === "Rəşidov").map((e) => e.fs).join(","));
      const seven = m.evs.find((e) => e.bText === "Rəşidov" && e.lines === 1);
      check(seven, w + ": a 7-letter name fits one line: " + JSON.stringify(m.evs.filter((e) => e.bText === "Rəşidov")));
      const long = m.evs.find((e) => e.bText === names[2]);
      check(long && long.lines >= 2, w + ": a long name goes on line under line: " + JSON.stringify(long));
      // the 8 px letter of a 7-letter line can shrink a little where a long name must fit a short block (360×740: an hour is
      // 28 px; «Leyla Məmmədova» in 1 hour → 7.5 px); never below 7 px, except a 30-minute block
      // owner 24.11: words are never broken in the middle; a long surname in a one-hour block may go down to 6 px instead
      check(ours.every((e) => e.fs >= 7 || e.bText === names[3] || (/\s/.test(e.bText) && e.fs >= 6)), w + ": letters not smaller than 7 px (6 px for a long two-word name, a 30-minute block apart): " + m.evs.map((e) => e.bText + "=" + e.fs + "/" + e.lines).join(", ") + " hour " + m.hour);
      // a tap on the block still opens the whole booking
      await p.click("#cal .ev:has-text(\"Leyla\")"); await p.locator("#sheet").waitFor(); await p.waitForTimeout(300);
      check(/050 000 00 1/.test(await p.textContent("#sheet")), w + ": the block opens the full booking (phone shown there)");
      check(!s.errors.length, w + ": no page errors: " + s.errors.join("; "));
    } finally { await s.close(); }
  }
};

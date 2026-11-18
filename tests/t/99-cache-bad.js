// Stability audit S-02: the copy kept on the phone (used to start without network) is checked item by item; a broken
// item (a half-written booking, an empty specialist) is left out instead of breaking the first screen. Opened with no
// network: the calendar shows, no error.
const { open, check, AGENT } = require("../lib");
module.exports = async () => {
  const s = await open(AGENT, { viewport: { width: 390, height: 844 } });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3500);
    await p.evaluate(() => { const k = "ruqya.cache.v1", o = JSON.parse(localStorage.getItem(k)); const d = o.s.appts[0] ? o.s.appts[0].date : "2026-11-18";
      o.s.appts.push({ id: "x1", date: d, readerId: o.s.readers[0].id, name: null, time: null, status: "wait", dur: 90 }, null, { date: d });
      o.s.readers.push(null, { name: "id yoxdur" }); localStorage.setItem(k, JSON.stringify(o)); localStorage.removeItem("ruqya.errlog"); });
    await p.route("**/rest/v1/**", (r) => r.abort("internetdisconnected"));
    await p.reload(); await p.waitForTimeout(4000);
    const st = await p.evaluate(() => ({ tabs: !document.getElementById("tabs").hidden, cols: document.querySelectorAll("#cal .col").length, login: !!document.getElementById("l-mail"), crash: document.body.innerText.includes("Ekranı göstərmək olmadı"), log: (JSON.parse(localStorage.getItem("ruqya.errlog") || "[]")).length }));
    check(st.tabs && st.cols > 0 && !st.login && !st.crash, "with a broken saved copy and no network the calendar shows: " + JSON.stringify(st));
    check(st.log === 0 && !s.errors.length, "no error: " + JSON.stringify(s.errors));
  } finally { await s.close(); }
};

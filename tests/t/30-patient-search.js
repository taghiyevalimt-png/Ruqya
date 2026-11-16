// B-15: a search with letters («Rəna 5») looks in names only; a search of digits only («555», «+994 55») still
// finds phones; both in «Pasiyentlər» and in «Ləğv olunanlar».
const { open, check, AGENT, seed, uuid, bakuToday, R1 } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  const add = (name, phone, status, off) => db.appts.push({ id: uuid(), reader_id: R1, date: bakuToday(off), time: "10:00", duration: 60, name, phone, price: 130, share: 0, status, note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: AGENT, created_at: now, updated_at: now });
  add("Rəna 5", "050 111 11 11", "wait", -3); add("Aysel", "055 555 12 34", "wait", -4);
  add("Rəna 5", "050 111 11 11", "cancel", -5); add("Aysel", "055 555 12 34", "cancel", -6);
  const s = await open(AGENT, { db });
  try {
    const p = s.page; await p.waitForSelector("#tabs:not([hidden])", { timeout: 15000 }); await p.waitForTimeout(3300);
    await p.click('#tabs [data-tab="patients"]'); await p.waitForTimeout(1500);
    const find = async (q) => { await p.fill("#q", q); await p.waitForTimeout(400); return p.$$eval("#plist b", (b) => b.map((x) => x.textContent)); };
    for (const sec of ["all", "cancel"]) {
      if (sec === "cancel") { await p.click('[data-act="p-sec"][data-id="cancel"]'); await p.waitForTimeout(500); }
      let n = await find("Rəna 5"); check(n.includes("Rəna 5") && !n.includes("Aysel"), sec + ": «Rəna 5» finds only Rəna (not phones with a 5): " + n.join(", "));
      n = await find("555"); check(n.includes("Aysel") && !n.includes("Rəna 5"), sec + ": «555» finds the phone: " + n.join(", "));
      n = await find("+994 55 555"); check(n.includes("Aysel"), sec + ": «+994 55 555» finds the phone: " + n.join(", "));
      n = await find("aysel"); check(n.includes("Aysel"), sec + ": name search ignores case: " + n.join(", "));
    }
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

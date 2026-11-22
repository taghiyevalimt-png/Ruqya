// A5-K2: «search works wrongly». Found by running: «memmedova» did not find «Məmmədova», «sukurov» not «Şükürov»
// (workers type without Azerbaijani letters), a double space split a name, «Aysel Məmmədova» was not found by
// «Məmmədova Aysel». Owner 22.11: letters are compared without Azerbaijani letters both ways. 60 queries with the
// expected result written down beforehand, on Pasiyentlər and on «Ləğv olunanlar». A number typed with its beginning
// (0…, +994…, 00…) is matched from the beginning («050» is not in «055 000…»), a piece («111 22») anywhere.
const { open, check, OWNER, seed, R1, bakuToday, uuid, AGENT } = require("../lib");
const P = [   // name, phone
  ["Aysel Məmmədova", "050 111 22 33"], ["Rəşad Şükürov", "+994 55 222 33 44"], ["İlqar Çələbiyev", "(070) 333-44-55"], ["Gülər Öztürk", "0050 777 66 55"],
  ["Ülviyyə Həsənova", "99455 888 99 00"], ["Мёд Алексеева", "051 123 45 67"], ["Nərgiz  Quliyeva", "077 765 43 21"], ["O'Nil Kərimli", "012 345 67 89"],
  ["Leyla", ""], ["AYSEL ƏLİYEVA", "050 999 00 11"], ["Elçin Ağayev", "055 000 11 22"], ["Ilqar Isgandarov", "050 444 55 66"]];
const Q = [   // query → expected names (any order)
  ["memmedova", ["Aysel Məmmədova"]], ["Məmmədova", ["Aysel Məmmədova"]], ["MƏMMƏDOVA", ["Aysel Məmmədova"]], ["mammadova", []],
  ["memmedova aysel", ["Aysel Məmmədova"]], ["aysel", ["Aysel Məmmədova", "AYSEL ƏLİYEVA"]], ["Aysel  Məmmədova", ["Aysel Məmmədova"]], ["  aysel  ", ["Aysel Məmmədova", "AYSEL ƏLİYEVA"]],
  ["sukurov", ["Rəşad Şükürov"]], ["Şükürov", ["Rəşad Şükürov"]], ["resad", ["Rəşad Şükürov"]], ["RƏŞAD", ["Rəşad Şükürov"]],
  ["ilqar", ["İlqar Çələbiyev", "Ilqar Isgandarov"]], ["İlqar", ["İlqar Çələbiyev", "Ilqar Isgandarov"]], ["ılqar", ["İlqar Çələbiyev", "Ilqar Isgandarov"]], ["celebiyev", ["İlqar Çələbiyev"]],
  ["çələbi", ["İlqar Çələbiyev"]], ["guler", ["Gülər Öztürk"]], ["ozturk", ["Gülər Öztürk"]], ["Öztürk", ["Gülər Öztürk"]],
  ["ulviyye", ["Ülviyyə Həsənova"]], ["hesenova", ["Ülviyyə Həsənova"]], ["мед", ["Мёд Алексеева"]], ["мёд", ["Мёд Алексеева"]],
  ["алексеева", ["Мёд Алексеева"]], ["nergiz quliyeva", ["Nərgiz  Quliyeva"]], ["nərgiz  quliyeva", ["Nərgiz  Quliyeva"]], ["o'nil", ["O'Nil Kərimli"]],
  ["kerimli", ["O'Nil Kərimli"]], ["leyla", ["Leyla"]], ["eliyeva", ["AYSEL ƏLİYEVA"]], ["elcin", ["Elçin Ağayev"]],
  ["agayev", ["Elçin Ağayev"]], ["isgandarov", ["Ilqar Isgandarov"]], ["zzz", []], ["aysel zzz", []],
  ["050 111 22 33", ["Aysel Məmmədova"]], ["0501112233", ["Aysel Məmmədova"]], ["+994 50 111 22 33", ["Aysel Məmmədova"]], ["+994501112233", ["Aysel Məmmədova"]],
  ["00994501112233", ["Aysel Məmmədova"]], ["(050) 111-22-33", ["Aysel Məmmədova"]], ["111 22", ["Aysel Məmmədova"]], ["1112233", ["Aysel Məmmədova"]],
  ["55 222", ["Rəşad Şükürov"]], ["0552223344", ["Rəşad Şükürov"]], ["333-44-55", ["İlqar Çələbiyev"]], ["0703334455", ["İlqar Çələbiyev"]],
  ["777 66 55", ["Gülər Öztürk"]], ["0507776655", ["Gülər Öztürk"]], ["888 99 00", ["Ülviyyə Həsənova"]], ["0518889900", []],
  ["051 123", ["Мёд Алексеева"]], ["7654321", ["Nərgiz  Quliyeva"]], ["050", ["Aysel Məmmədova", "AYSEL ƏLİYEVA", "Ilqar Isgandarov", "Gülər Öztürk"]], ["99900", ["AYSEL ƏLİYEVA"]],
  ["a​ysel", ["Aysel Məmmədova", "AYSEL ƏLİYEVA"]], ["aysel memmedova", ["Aysel Məmmədova"]], ["çələbiyev", ["İlqar Çələbiyev"]], ["", "ALL"]];
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  db.appts = P.map((x, i) => ({ id: uuid(), reader_id: R1, date: bakuToday(-1 - i), time: "10:00", duration: 60, name: x[0], phone: x[1], price: 130, share: 0, status: i % 2 ? "cancel" : "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: AGENT, created_at: now, updated_at: now }));
  const s = await open(OWNER, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
    await p.click('#tabs [data-tab="patients"]'); await p.waitForTimeout(400);
    const shown = (sel) => p.evaluate((sel) => [...document.querySelectorAll(sel)].map((b) => b.textContent.replace(/^[✅ \s+]+/, "").trim()), sel);
    const bad = [], log = [];
    for (const sec of ["all", "cancel"]) {
      await p.click('[data-act="p-sec"][data-id="' + sec + '"]'); await p.waitForTimeout(200);
      const sel = sec === "all" ? '#plist [data-act="patient"] b' : '#plist [data-act="view-appt"] b';
      const pool = sec === "all" ? P.map((x) => x[0]) : P.filter((x, i) => i % 2).map((x) => x[0]);
      for (const [q, exp] of Q) {
        await p.fill("#q", q); await p.waitForTimeout(170);
        const got = (await shown(sel)).sort(), want = (exp === "ALL" ? pool : exp.filter((n) => pool.includes(n))).slice().sort();
        const ok = JSON.stringify(got) === JSON.stringify(want); log.push((ok ? "ok   " : "FAIL ") + sec + " " + JSON.stringify(q) + " → " + JSON.stringify(got)); if (!ok) bad.push(sec + " " + JSON.stringify(q) + " want " + JSON.stringify(want) + " got " + JSON.stringify(got));
      }
    }
    // the result always follows the last thing typed (fast typing)
    await p.click('[data-act="p-sec"][data-id="all"]');
    for (const ch of "sukurov") await p.type("#q", ch, { delay: 15 });
    await p.waitForTimeout(250); const last = await shown('#plist [data-act="patient"] b');
    require("fs").mkdirSync(require("path").join(__dirname, "..", "out"), { recursive: true }); require("fs").writeFileSync(require("path").join(__dirname, "..", "out", "a5-k2-search.txt"), log.join("\n") + "\n");
    check(!bad.length, bad.length + " of " + (Q.length * 2) + " queries wrong: " + bad.slice(0, 6).join(" | "));
    check(JSON.stringify(last) === JSON.stringify(["Rəşad Şükürov"]), "fast typing: the list is for the last query: " + JSON.stringify(last));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

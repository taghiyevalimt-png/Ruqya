// Owner 23.11: in the sale window the top products come first, in his order — Ruqyalı su, Ruqyalı içməli su, Ruqyalı
// duzlu su, Ruqyalı sidr tozu (in the catalog: «Sidr tozu»), Ruqyalı Zeytun yağı, Ruqyalı Gül suyu, Ruqyalı Nanə suyu —
// then all the others in the catalog order. The names below are the live catalog's (23.11).
const { open, check, AGENT, seed } = require("../lib");
const NAMES = ["İbn Davud Zeyt yağı", "Dr.Taymasova Neurocalm", "Nar suyu", "Aloe-bal məcunu", "İmmunitet məcunu", "Ruqyalı içməli su", "Ruqyalı su", "Ruqyalı duzlu su", "Ruqyalı sirkə", "Ruqyalı saç qarışımı yağı", "Ruqyalı küncüt yağı", "Ruqyalı kətan yağı", "Sultan məcunu", "Qaraciyər məcunu", "Ruqyalı qara zirə yağı", "Ruqyalı dəfnə yağı", "Ruqyalı zəncəfil yağı", "Ruqyalı sidr yağı", "Ruqyalı nanə suyu", "Ruqyalı bal 250gr", "Ruqyalı bal 350gr", "Ruqyalı bal 700gr", "Ruqyalı udi hindi yağı", "Ruqyalı zəmzəm suyu", "Udi hindi tozu", "Sidr tozu", "Ruqyalı zeytun yağı", "Ruqyalı şaftalı suyu", "Ruqyalı gül suyu", "Dr.Günel Qripə son məcunu", "Dr.Günel Saç üçün yağ qarışımı", "Dr.Günel Oynaq, sinir, təbii yağ qarışımı"];
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  db.products = NAMES.map((n, i) => ({ id: "cccccccc-0000-4000-8000-" + String(100000000000 + i), name: n, price: 2 + i, archived: false, sort: i + 1, created_at: now }));
  const s = await open(AGENT, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await p.click('#tabs [data-tab="cash"]'); await p.click('[data-act="new-prod"]'); await p.locator("#sheet .pbtn").first().waitFor();
    const g = await p.evaluate(() => [...document.querySelectorAll("#sheet .pgrid")].map((x) => [...x.querySelectorAll(".pbtn b")].map((b) => b.textContent)));
    const heads = await p.evaluate(() => [...document.querySelectorAll("#sheet h3.ptop")].map((x) => x.textContent));
    check(JSON.stringify(heads) === '["Əsas məhsullar","Digər məhsullar"]', "two parts: " + JSON.stringify(heads));
    check(JSON.stringify(g[0]) === JSON.stringify(["Ruqyalı su", "Ruqyalı içməli su", "Ruqyalı duzlu su", "Sidr tozu", "Ruqyalı zeytun yağı", "Ruqyalı gül suyu", "Ruqyalı nanə suyu"]), "top products in the owner's order: " + JSON.stringify(g[0]));
    check(g[1].length === NAMES.length - 7 && g[1][0] === "İbn Davud Zeyt yağı" && !g[1].includes("Ruqyalı su") && g[1].includes("Ruqyalı sidr yağı"), "then the others in catalog order, none twice: " + g[1].slice(0, 3));
    // a tap on a top product counts as before
    await p.click('#sheet .pgrid >> nth=0 >> .pbtn >> nth=0'); await p.waitForTimeout(150);
    check(/Cəmi: 1 məhsul/.test(await p.textContent("#sheet")), "a tap on a top product adds it");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

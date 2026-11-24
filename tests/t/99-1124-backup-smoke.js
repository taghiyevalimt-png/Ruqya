// 24.11: the scheduled backup drill (scripts/restore-smoke.js) failed since 22.11 with «no period choice in the Excel
// window»: the Excel window lost its period buttons when the file became the statistics tables. The drill must only use
// what the app really shows: every data-act it clicks exists in index.html, and the ready window says
// «Fayl hazırdır: N vərəq, M qəbul.» (the line the drill reads), with M = the appointments the file was made from.
const fs = require("fs"), path = require("path");
const { open, check, OWNER, seed } = require("../lib");
module.exports = async () => {
  const root = path.join(__dirname, "..", ".."), app = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const smoke = fs.readFileSync(path.join(root, "scripts", "restore-smoke.js"), "utf8");
  const acts = [...new Set([...smoke.matchAll(/data-act=([\w-]+)/g)].map((m) => m[1]))];
  const missing = acts.filter((a) => !app.includes('data-act="' + a + '"') && !app.includes('data-act=\\"' + a + '\\"'));
  check(acts.length && !missing.length, "every button the drill clicks exists in the app: " + acts.join(",") + (missing.length ? " missing " + missing.join(",") : ""));
  const re = new RegExp(smoke.match(/const re=\/(.*)\/;/)[1]);
  const db = seed();
  const s = await open(OWNER, { db });
  try {
    const p = s.page;
    await p.waitForSelector("text=Test Pasiyent", { timeout: 15000 }); await p.waitForTimeout(3200);
    await p.click('#tabs [data-tab="stats"]'); await p.click('[data-act="xls"]');
    await p.waitForFunction((r) => new RegExp(r).test((document.querySelector("#sheet") || {}).textContent || ""), re.source, { timeout: 15000 }).catch(() => {});
    const t = await p.textContent("#sheet"), m = t.match(re);
    check(!!m, "the ready Excel window shows the line the drill reads: " + t.slice(0, 160));
    if (m) check(+m[2] > 0 && +m[2] <= db.appts.length, "it counts the appointments the file was made from: " + m[2] + " of " + db.appts.length);
    check(!/Pul/.test(t), "the window no longer lists the removed «Pul» sheet");
  } finally { await s.close(); }
};

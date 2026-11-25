// 25.11 check-up fixes:
//  (1) «Kopyala» in a statistics card: after copying, the title stays readable (it was squeezed into one letter a line
//      by the long «Kopyalandı ✓ — WhatsApp-a yapışdırın» label); the hint goes to the toast.
//  (2) The toast is as wide as its text (it was capped at half the screen — left:50% without a width).
//  (3) The every-minute notification job also runs for the evening report alone (it used to need reminders or alerts).
const fs = require("fs"), path = require("path");
const { open, check, OWNER, seed } = require("../lib");
module.exports = async () => {
  // (3) the latest schedule of «ruqya-notify» must wake up for every kind ruqya_notify_due sends
  const dir = path.join(__dirname, "..", "..", "sql");
  const files = fs.readdirSync(dir).filter((f) => /^2026-.*\.sql$/.test(f)).sort();
  const job = files.filter((f) => /cron\.schedule\('ruqya-notify'/.test(fs.readFileSync(path.join(dir, f), "utf8"))).pop();
  const due = files.filter((f) => /function public\.ruqya_notify_due/.test(fs.readFileSync(path.join(dir, f), "utf8"))).pop();
  const jw = fs.readFileSync(path.join(dir, job), "utf8").match(/where p\.([^\n]*?)\)\s*\n/)[1];
  const dw = fs.readFileSync(path.join(dir, due), "utf8").match(/prefs as \([\s\S]*?where \(([^)]*)\)/)[1];
  const kinds = (s) => (s.match(/p\.(remind_min|on_new|report)/g) || []).map((x) => x.slice(2)).sort().join(",");
  check(kinds("p." + jw) === kinds(dw), "job " + job + " wakes for [" + kinds("p." + jw) + "], " + due + " sends [" + kinds(dw) + "]");
  check(fs.existsSync(path.join(dir, "rollback-" + job)), "rollback for " + job);

  const s = await open(OWNER, { db: seed(), viewport: { width: 360, height: 780 } });
  try {
    const p = s.page; await s.context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: s.base });
    await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(1500);
    await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(1200);
    const card = p.locator('.pay.sess').first(); await card.scrollIntoViewIfNeeded();
    const btn = card.locator('[data-act="st-copy-t"]'); await btn.click(); await p.waitForTimeout(400);
    const m = await card.evaluate((c) => { const b = c.querySelector(".head>b"), t = document.getElementById("toast"), r = b.getBoundingClientRect(), lh = parseFloat(getComputedStyle(b).fontSize) * 1.6;
      return { lines: Math.round(r.height / lh), w: r.width, btn: c.querySelector('[data-act="st-copy-t"]').textContent, toast: t && t.textContent, tw: t && t.getBoundingClientRect().width, th: t && t.getBoundingClientRect().height }; });
    check(m.lines <= 2 && m.w > 100, "title squeezed after copy: " + JSON.stringify(m));
    check(m.btn === "Kopyalandı ✓", "button label " + m.btn);
    check(/WhatsApp/.test(m.toast || ""), "hint in toast: " + m.toast);
    check(m.tw > 360 / 2 + 20 && m.th < 50, "toast one line, wider than half the screen: " + JSON.stringify(m));
    await p.waitForTimeout(2700);
    check((await btn.textContent()) === "⧉ Kopyala", "label back: " + (await btn.textContent()));
  } finally { await s.close(); }
};

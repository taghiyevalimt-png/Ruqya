// Owner 28.11: «Tətbiqdəki bütün "bu gün" sözlər "bugün" olmalıdır». Where it means «today» the app writes «Bugün»;
// «bu gün» stays only where it means «this day» (another date): «Bu günə qəbul yoxdur», «Yalnız bu gün (…)», «Bu günlərdə».
const fs = require("fs"), path = require("path");
const { open, check, OWNER, seed } = require("../lib");
module.exports = async () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");
  const left = (src.match(/[Bb]u gün.{0,25}/g) || []).filter((x) => !/^(Bu günlərdə|bu gün \(\{d\}\)|Bu günə qəbul yoxdur)/.test(x));
  check(!left.length, "no «bu gün» meaning today left in the app: " + JSON.stringify(left));
  const java = fs.readFileSync(path.join(__dirname, "..", "..", "android/app/src/main/java/az/ruqya/zapis/AgendaDraw.java"), "utf8");
  check(/"Bugün"/.test(java) && !/"Bu gün"/.test(java), "Android day widget: «Bugün»");
  const s = await open(OWNER, { db: seed() });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(1200);
    const top = await p.textContent("#top");
    check(/Bugün/.test(top) && !/Bu gün/.test(top), "calendar head says «Bugün»: " + top);
    await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(600);
    const chips = await p.$$eval('#top [data-act="st-sec"]', (xs) => xs.map((x) => x.textContent.trim()));
    check(chips[0] === "Bugün", "first chip «Bugün»: " + chips);
    await p.click('#top [data-act="st-sec"][data-id="today"]'); await p.waitForTimeout(400);
    const all = (await p.innerText("#top")) + "\n" + (await p.innerText("#main")) + "\n" + (await p.innerText("#tabs"));
    const bad = all.match(/[Bb]u gün(?!lər|ə).{0,30}/); check(/Bugün/.test(all) && !bad, "statistics: «Bugün», no «bu gün»: " + bad);
    check(!s.errors.length, "no page errors: " + s.errors.join(" | "));
  } finally { await s.close(); }
};

// V-01/V-02: axe-core WCAG 2.1 A/AA rules on the main screens (owner, light): 0 violations.
const fs = require("fs");
const { open, check, OWNER } = require("../lib");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
module.exports = async () => {
  const s = await open(OWNER, { bypassCSP: true });
  try {
    const p = s.page; await p.waitForSelector("#cal .ev"); await p.waitForTimeout(3300);
    const bad = [];
    const run = async (label) => { await p.addScriptTag({ content: AXE }).catch(() => {}); const v = await p.evaluate(async () => (await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations.map((x) => x.id + ":" + x.nodes.length)); if (v.length) bad.push(label + " → " + v.join(", ")); };
    await run("Qəbullar");
    await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(400); await p.click('#top [data-act="st-sec"][data-id="rules"]'); await p.waitForTimeout(300); await run("Statistika/Qaydalar");
    await p.click('#tabs [data-tab="patients"]'); await p.waitForTimeout(400); await run("Pasiyentlər");
    await p.click('#tabs [data-tab="readers"]'); await p.waitForTimeout(400); await run("Ayarlar");
    check(!bad.length, "axe violations: " + bad.join(" | "));
  } finally { await s.close(); }
};

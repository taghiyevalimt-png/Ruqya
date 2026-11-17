// Requirement 6: the app needs nothing but its own site and its own database — no fonts, scripts, images, analytics
// or other requests to third parties — so it works in a closed network. Every resource the page loads while
// every tab, a window and the patient list are used must come from the site itself or the database host.
const { open, check, OWNER } = require("../lib");
module.exports = async () => {
  const s = await open(OWNER, {});
  try {
    const p = s.page; await p.waitForSelector("#cal .ev", { timeout: 15000 }); await p.waitForTimeout(3300);
    for (const t of ["stats", "cash", "patients", "readers", "day"]) { await p.click('#tabs [data-tab="' + t + '"]'); await p.waitForTimeout(500); }
    await p.click("#fab"); await p.waitForSelector("#f-name"); await p.click('[data-act="close"]'); await p.click('[data-act="draft-drop"]', { timeout: 800 }).catch(() => {});
    const r = await p.evaluate(() => { const db = new URL(window.__sbUrl || "https://ldkhdeehrrajvgrtieal.supabase.co").host; const all = [location.href].concat(performance.getEntriesByType("resource").map((e) => e.name)); return { hosts: [...new Set(all.map((u) => new URL(u).host))], own: location.host, db }; });
    const other = r.hosts.filter((h) => h !== r.own && h !== r.db);
    check(r.hosts.includes(r.own), "the page loads from its own site: " + r.hosts.join(", "));
    check(other.length === 0, "no third-party hosts (only " + r.own + " and the database " + r.db + "): " + other.join(", "));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};

// Every request the live site makes while opening (sign-in screen, no account): host, type, status.
//   node tests/perf/live-network.js <out.json> [url]
const { chromium } = require("playwright-core"); const fs = require("fs");
(async () => {
  const url = process.argv[3] || "https://taghiyevalimt-png.github.io/Ruqya/";
  const b = await chromium.launch({ channel: "chrome" }); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const reqs = [], cons = [];
  p.on("requestfinished", async (r) => { const res = await r.response(); reqs.push({ host: new URL(r.url()).host, path: new URL(r.url()).pathname, type: r.resourceType(), status: res && res.status() }); });
  p.on("requestfailed", (r) => reqs.push({ host: new URL(r.url()).host, path: new URL(r.url()).pathname, type: r.resourceType(), failed: r.failure() && r.failure().errorText }));
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") cons.push(m.type() + ": " + m.text()); });
  p.on("pageerror", (e) => cons.push("pageerror: " + e));
  await p.goto(url, { waitUntil: "networkidle" }); await p.waitForTimeout(4000);
  const hosts = [...new Set(reqs.map((r) => r.host))];
  const out = { at: new Date().toISOString(), url, hosts, requests: reqs, console: cons, bytesNote: "sizes not recorded here; see vitals.json" };
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  console.log("hosts:", hosts.join(", "), "| requests:", reqs.length, "| console errors/warnings:", cons.length);
  await b.close();
})();

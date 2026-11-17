// What the largest paint is and what it waits for, on the same profile as vitals.js.
// node tests/perf/lcp-breakdown.js — prints every LCP candidate (time, element, size), the ready class time and
// each own file with its response end.
const { open, AGENT } = require("../lib");
(async () => {
  const s = await open(AGENT, { viewport: { width: 412, height: 823 }, noWait: true });
  const p = s.page, cdp = await p.context().newCDPSession(p);
  try {
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 0.75e6 / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await p.addInitScript(() => {
      window.__l = []; window.__ready = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) { const el = e.element; window.__l.push([Math.round(e.startTime), e.size, el ? el.tagName + (el.id ? "#" + el.id : "") + (el.className ? "." + String(el.className).split(" ")[0] : "") : "?", Math.round(e.renderTime || 0), Math.round(e.loadTime || 0)]); } }).observe({ type: "largest-contentful-paint", buffered: true });
      new MutationObserver(() => { if (!window.__ready && document.documentElement.classList.contains("ready")) window.__ready = Math.round(performance.now()); }).observe(document.documentElement, { attributes: true });
    });
    await p.reload({ waitUntil: "load" });
    await p.waitForSelector("#cal .ev", { timeout: 60000 }); await p.waitForTimeout(3000);
    const r = await p.evaluate(() => ({ lcp: window.__l, ready: window.__ready, nav: performance.getEntriesByType("navigation").map((n) => [Math.round(n.responseEnd), Math.round(n.domContentLoadedEventEnd), Math.round(n.loadEventEnd)])[0], res: performance.getEntriesByType("resource").filter((x) => x.name.startsWith(location.origin)).map((x) => [x.name.replace(location.origin, ""), Math.round(x.startTime), Math.round(x.responseEnd), x.transferSize || x.encodedBodySize]) }));
    console.log("LCP candidates [start ms, size, element, render, load]:"); r.lcp.forEach((x) => console.log("  ", JSON.stringify(x)));
    console.log("html.ready at", r.ready, "ms; navigation [responseEnd, DCL, load]", JSON.stringify(r.nav));
    console.log("own files [path, start, end, bytes]:"); r.res.forEach((x) => console.log("  ", JSON.stringify(x)));
  } finally { await s.close(); }
})();

// node tests/run.js [filter]  — runs tests/t/*.js one by one, prints PASS/FAIL, exit code = failures
const fs = require("fs"), path = require("path");
(async () => {
  const dir = path.join(__dirname, "t"), f = process.argv[2] || "";
  const files = fs.readdirSync(dir).filter((x) => x.endsWith(".js") && x.includes(f)).sort();
  let bad = 0;
  for (const x of files) {
    const t0 = Date.now();
    try { await require(path.join(dir, x))(); console.log("PASS", x, ((Date.now() - t0) / 1000).toFixed(1) + "s"); }
    catch (e) { bad++; console.log("FAIL", x, "\n   ", String(e && e.stack || e).split("\n").slice(0, 3).join("\n    ")); }
  }
  console.log(bad ? bad + " failed of " + files.length : "all " + files.length + " passed");
  process.exit(bad ? 1 : 0);
})();

// Old Android / iPhone browsers: every inline script of the page must be plain ES5 (the project has no build step).
const acorn = require("acorn"), fs = require("fs"), path = require("path");
module.exports = async () => {
  const s = fs.readFileSync(path.join(__dirname, "../../index.html"), "utf8");
  const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  scripts.forEach((src, i) => {
    try { acorn.parse(src, { ecmaVersion: 5 }); }
    catch (e) { const l = src.split("\n")[e.loc.line - 1] || ""; throw new Error("inline script " + (i + 1) + " is not ES5: " + e.message + " … " + l.slice(Math.max(0, e.loc.column - 60), e.loc.column + 60)); }
  });
};

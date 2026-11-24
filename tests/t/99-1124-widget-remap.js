// 24.11 Design 4.0: the widget must never show the old bright specialist colours. The app sends rcolor() (already
// remapped), and the widget itself remaps the same table, for data saved by an older app version — both tables equal.
const fs = require("fs"), path = require("path");
const { check } = require("../lib");
module.exports = async () => {
  const root = path.join(__dirname, "..", "..");
  const a = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const j = fs.readFileSync(path.join(root, "android/app/src/main/java/az/ruqya/zapis/MonthWidget.java"), "utf8");
  const R = Object.fromEntries([...a.match(/var REMAP=\{[^}]*\}/)[0].matchAll(/"(#\w{6})":"(#\w{6})"/g)].map((m) => [m[1], m[2]]));
  const jm = j.match(/String\[\] m = \{[^}]*\}/);
  check(!!jm, "the widget has its own colour remap table");
  if (!jm) return;
  const m = [...jm[0].matchAll(/"(#\w{6})"/g)].map((x) => x[1]), J = {};
  for (let i = 0; i < m.length; i += 2) J[m[i]] = m[i + 1];
  check(JSON.stringify(R) === JSON.stringify(J), "the widget's table equals the app's REMAP (" + Object.keys(R).length + " colours)");
  check(/REMAP\.get\(s\.toLowerCase/.test(j), "parseColor uses the table");
  const ag = fs.readFileSync(path.join(root, "android/app/src/main/java/az/ruqya/zapis/AgendaDraw.java"), "utf8");
  check(/MonthWidget\.parseColor/.test(ag) && !/0xFF546E7A/.test(ag + j), "the day/week widgets use the same parseColor, no old grey fallback");
};

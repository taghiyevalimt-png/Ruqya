// B-21: every interface text written as L('…') has its Russian translation — the dictionary key must be exactly the
// Azerbaijani text (markup included), so changing the markup in one place and not in the other left the phone label
// «Mobil nömrə» untranslated in the Russian interface. Static check of index.html; DICT_OUT=<file> lists the misses.
const fs = require("fs"), path = require("path");
const { check } = require("../lib");
// texts that are the same in both languages (names, symbols, technical words)
const SAME = new Set(["Wp", "Excel", "Ruqya", "Hijama", "Mərkəz"]);
module.exports = async () => {
  const s = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");
  const start = s.indexOf('var RUD=LANG==="ru"?{') + 'var RUD=LANG==="ru"?'.length;
  let i = start, depth = 0, inStr = false;
  for (; i < s.length; i++) { const ch = s[i]; if (inStr) { if (ch === "\\") i++; else if (ch === '"') inStr = false; continue; } if (ch === '"') inStr = true; else if (ch === "{") depth++; else if (ch === "}") { depth--; if (!depth) break; } }
  const RUD = new Function("return " + s.slice(start, i + 1))();
  const keys = new Set(Object.keys(RUD));
  const re = /\bL\(('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\)/g; let m, n = 0; const miss = [];
  while ((m = re.exec(s))) {
    if (m.index < i) continue;
    n++; const v = new Function("return " + m[1])();
    if (!keys.has(v) && !SAME.has(v) && /[a-zəğıöüşç]/i.test(v.replace(/<[^>]*>/g, ""))) miss.push(v);
  }
  if (process.env.DICT_OUT) fs.writeFileSync(process.env.DICT_OUT, "# L() literal calls: " + n + ", dictionary keys: " + keys.size + ", without translation: " + miss.length + "\n" + miss.join("\n") + "\n");
  check(n > 200, "found the interface texts: " + n);
  check(miss.length === 0, miss.length + " texts without a Russian translation: " + miss.map((x) => x.slice(0, 80)).join(" | "));
};

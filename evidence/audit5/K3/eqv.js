// A5-K3: the app's pkey() and the database's ruqya_pkey() give the same key for the same booking (2 000 tricky names)
const fs = require("fs"), { execFileSync } = require("child_process");
const html = fs.readFileSync("/home/claude/ruqya/index.html", "utf8");
const i0 = html.indexOf("function low(x){"), i1 = html.indexOf("\n", html.indexOf("function digits(p){"));
const code = html.slice(i0, i1) + "\n" + html.match(/function pkey\(a\)\{[^\n]*\n/)[0];
const ctx = {}; new Function("ctx", code + "\nctx.pkey=pkey;ctx.fold=fold;")(ctx);
const parts = ["Aysel", "AYSEL", "aysel", "Məmmədova", "MƏMMƏDOVA", "Memmedova", "Şükürov", "ŞÜKÜROV", "Sukurov", "İlqar", "ILQAR", "ılqar", "Çinarə", "Ğ", "Öz", "Ülviyyə", "Мёд", "МЁД", "Мед", "Анна", "О'Нил", "Ли-Ван", "😀", "a​b", "x y", "ça", "  ", "\t"];
let rnd = 7; const R = () => (rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648;
const rows = [];
for (let i = 0; i < 2000; i++) {
  const n = Array.from({ length: 1 + Math.floor(R() * 3) }, () => parts[Math.floor(R() * parts.length)]).join(R() < .3 ? "  " : " ");
  const ph = ["", "12", "050 111 22 33", "+994 (50) 111-22-33", "0050111223", "1234567", "9940501112233"][Math.floor(R() * 7)];
  rows.push([ph, (R() < .2 ? "  " : "") + n + (R() < .2 ? " " : "")]);
}
const esc = (s) => "'" + s.replace(/'/g, "''") + "'";
const sql = "select ruqya_pkey(p,n) from (values " + rows.map((r, i) => "(" + i + "," + esc(r[0]) + "," + esc(r[1]) + ")").join(",") + ") v(i,p,n) order by i";
const db = execFileSync("psql", ["-h", "127.0.0.1", "-p", "54330", "-U", "postgres", "-d", process.argv[2] || "eqv", "-tA", "-c", sql], { encoding: "utf8", maxBuffer: 1e8 }).split("\n").slice(0, rows.length);
let bad = 0; rows.forEach((r, i) => { const j = ctx.pkey({ phone: r[0], name: r[1] }); if (j !== db[i]) { if (bad < 8) console.log("DIFF", JSON.stringify(r), JSON.stringify(j), JSON.stringify(db[i])); bad++; } });
console.log("rows", rows.length, "different keys", bad);
process.exit(bad ? 1 : 0);

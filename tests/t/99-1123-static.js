// 23.11 (bug hunt): static checks of the app script, so a mistyped or deleted helper is caught before publishing
// (earlier today `sellers()` was deleted by accident and only a click test noticed it).
//   1. every identifier read in the script is declared somewhere (or is a browser global);
//   2. no function is declared twice in the same scope (the second copy silently replaces the first);
//   3. no function is declared and never used (dead code hides old logic that may be revived by mistake).
const fs = require("fs"), path = require("path"), acorn = require("acorn"), walk = require("acorn-walk");
const { check } = require("../lib");
module.exports = async () => {
  const html = fs.readFileSync(path.join(__dirname, "../../index.html"), "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const src = scripts[scripts.length - 1];
  const ast = acorn.parse(src, { ecmaVersion: 5, locations: true });
  const declared = new Set(), used = new Map(), perScope = new Map(), fnNames = new Set();
  walk.full(ast, (n) => {
    if (n.type === "VariableDeclarator" && n.id.type === "Identifier") declared.add(n.id.name);
    if ((n.type === "FunctionDeclaration" || n.type === "FunctionExpression") && n.id) declared.add(n.id.name);
    if (n.type === "FunctionDeclaration" || n.type === "FunctionExpression") n.params.forEach((p) => p.type === "Identifier" && declared.add(p.name));
    if (n.type === "CatchClause" && n.param) declared.add(n.param.name);
  });
  walk.ancestor(ast, {
    FunctionDeclaration(n, anc) {
      let scope = null;
      for (let i = anc.length - 2; i >= 0; i--) if (/Function/.test(anc[i].type)) { scope = anc[i]; break; }
      const key = (scope ? scope.start : -1) + ":" + n.id.name;
      perScope.set(key, (perScope.get(key) || 0) + 1); fnNames.add(n.id.name);
    },
    Identifier(n, anc) {
      const p = anc[anc.length - 2];
      if (p && p.type === "MemberExpression" && p.property === n && !p.computed) return;
      if (p && p.type === "Property" && p.key === n && !p.computed) return;
      if (p && (p.type === "FunctionDeclaration" || p.type === "FunctionExpression")) return;
      if (p && p.type === "VariableDeclarator" && p.id === n) return;
      if (p && (p.type === "LabeledStatement" || p.type === "BreakStatement" || p.type === "ContinueStatement")) return;
      if (!used.has(n.name)) used.set(n.name, n.loc.start.line);
    },
  });
  const globals = new Set(Object.getOwnPropertyNames(globalThis).concat(["window","document","navigator","location","localStorage","sessionStorage","history","fetch","Intl","requestAnimationFrame","cancelAnimationFrame","getComputedStyle","performance","console","setTimeout","clearTimeout","setInterval","clearInterval","Blob","URL","FileReader","Image","Node","Element","HTMLElement","Event","CustomEvent","MutationObserver","IntersectionObserver","ResizeObserver","PerformanceObserver","crypto","alert","confirm","prompt","screen","matchMedia","atob","btoa","TextEncoder","TextDecoder","CompressionStream","Response","Request","Headers","AbortController","visualViewport","supabase","LANG","applyTheme","arguments","undefined","NaN","Infinity","innerWidth","innerHeight","scrollY","scrollTo","open","close","print","XMLHttpRequest","FormData","ClipboardItem","DOMParser","Uint8Array","ArrayBuffer","DataView","globalThis","self"]));
  const missing = [...used].filter(([k]) => !declared.has(k) && !globals.has(k)).map(([k, l]) => k + " (line " + l + ")");
  check(!missing.length, "undeclared names: " + missing.join(", "));
  const twice = [...perScope].filter(([, c]) => c > 1).map(([k]) => k.split(":")[1]);
  check(!twice.length, "functions declared twice in one scope: " + twice.join(", "));
  const dead = [...fnNames].filter((f) => !used.has(f));
  check(!dead.length, "functions never used: " + dead.join(", "));
};

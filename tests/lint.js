// Static analysis: ESLint 9.15 (recommended rules) + eslint-plugin-security 3.0.1 over the app's inline scripts
// (extracted from index.html, ES5, browser) and the Node tools in tools/.   node tests/lint.js [report.txt]
const fs = require("fs"), path = require("path"), { ESLint } = require("eslint");
const js = require("@eslint/js"), security = require("eslint-plugin-security"), globals = require("globals");
const root = path.resolve(__dirname, "..");
(async () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const lint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: [
    { ...js.configs.recommended, ...security.configs.recommended, plugins: { security },
      rules: { ...js.configs.recommended.rules, ...security.configs.recommended.rules, "no-empty": "off" },
      languageOptions: { ecmaVersion: 5, sourceType: "script", globals: { ...globals.browser, supabase: "readonly" } } },
    { files: ["tools/**/*.js"], languageOptions: { ecmaVersion: 2022, sourceType: "commonjs", globals: { ...globals.node } } },
  ] });
  const res = [];
  for (let i = 0; i < scripts.length; i++) res.push(...(await lint.lintText(scripts[i], { filePath: path.join(root, "index.html.script" + (i + 1) + ".js") })));
  res.push(...(await lint.lintFiles(["tools/*.js"])));
  const lines = ["# ESLint 9.15.0 + eslint-plugin-security 3.0.1 — " + new Date().toISOString()];
  let n = 0;
  for (const r of res) for (const m of r.messages) { n++; lines.push(path.relative(root, r.filePath) + ":" + m.line + ":" + m.column + "  " + (m.ruleId || "parse") + "  " + m.message); }
  lines.splice(1, 0, "# messages: " + n);
  const by = {}; for (const r of res) for (const m of r.messages) by[m.ruleId] = (by[m.ruleId] || 0) + 1;
  lines.splice(2, 0, "# by rule: " + JSON.stringify(by));
  if (process.argv[2]) fs.writeFileSync(process.argv[2], lines.join("\n") + "\n");
  console.log(lines.slice(0, 3).join("\n"));
})();

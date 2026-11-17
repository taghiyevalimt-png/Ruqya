// B-19: a copy made by tools/configure.py (another database, the customer's server) holds every local file the page
// refers to (src, href, srcset, url() in fonts.css) — before the fix the WebP logo of P-02 was left out.
const fs = require("fs"), os = require("os"), path = require("path"), { execFileSync } = require("child_process");
const { check } = require("../lib");
module.exports = async () => {
  const root = path.join(__dirname, "..", ".."), out = fs.mkdtempSync(path.join(os.tmpdir(), "ruqya-cfg-"));
  try {
    execFileSync(process.env.PYTHON || "python", [path.join(root, "tools", "configure.py"), path.join(out, "site")], { env: { ...process.env, SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_ANON_KEY: "sb_publishable_test_key_for_copy_check" }, stdio: "pipe" });
    const site = path.join(out, "site"), html = fs.readFileSync(path.join(site, "index.html"), "utf8");
    const refs = new Set();
    for (const m of html.matchAll(/(?:src|href|srcset)="([^"]+)"/g)) for (const part of m[1].split(",")) { const u = part.trim().split(/\s+/)[0]; if (u && !/^(https?:|data:|#|mailto:|tel:|javascript:|\/\/)/i.test(u) && !/[{}'+]/.test(u)) refs.add(u.split(/[?#]/)[0]); }
    const css = fs.readFileSync(path.join(site, "vendor", "fonts", "fonts.css"), "utf8");
    for (const m of css.matchAll(/url\(([^)]+)\)/g)) refs.add("vendor/fonts/" + m[1].replace(/["']/g, ""));
    const missing = [...refs].filter((r) => !fs.existsSync(path.join(site, r)));
    check(refs.size > 10, "found the page's local references: " + refs.size);
    check(missing.length === 0, "every local file the page refers to is in the configured copy; missing: " + missing.join(", "));
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
};

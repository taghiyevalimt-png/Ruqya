#!/usr/bin/env node
// Software bill of materials in CycloneDX 1.5 JSON: what the delivered app contains (scope "required") and what is
// used only to build/test it (scope "excluded": tests/node_modules from tests/package-lock.json, CI actions).
//   node tools/sbom.js > sbom.cdx.json
const fs = require("fs"), path = require("path"), crypto = require("crypto"), root = path.resolve(__dirname, "..");
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, f))).digest("hex");
const comps = [
  { type: "library", name: "@supabase/supabase-js", version: "2.45.4", scope: "required", purl: "pkg:npm/%40supabase/supabase-js@2.45.4", licenses: [{ license: { id: "MIT" } }], hashes: [{ alg: "SHA-256", content: sha("vendor/supabase-2.45.4.js") }],
    description: "bundled UMD build in vendor/; contains @supabase/auth-js 2.65.0, realtime-js 2.10.2, storage-js 2.7.0, postgrest-js, functions-js", properties: [{ name: "file", value: "vendor/supabase-2.45.4.js" }] },
  { type: "library", name: "@supabase/auth-js", version: "2.65.0", scope: "required", purl: "pkg:npm/%40supabase/auth-js@2.65.0", licenses: [{ license: { id: "MIT" } }], description: "inside supabase-js bundle; GHSA-8r88-6cj9-9fh5 (LOW) applies to versions <= 2.69.1" },
  { type: "library", name: "@supabase/realtime-js", version: "2.10.2", scope: "required", purl: "pkg:npm/%40supabase/realtime-js@2.10.2", licenses: [{ license: { id: "MIT" } }] },
  { type: "library", name: "@supabase/storage-js", version: "2.7.0", scope: "required", purl: "pkg:npm/%40supabase/storage-js@2.7.0", licenses: [{ license: { id: "MIT" } }] },
  { type: "data", name: "Golos Text (font)", version: "Google Fonts 2026-11", scope: "required", licenses: [{ license: { id: "OFL-1.1" } }], properties: [{ name: "files", value: "vendor/fonts/*.woff2" }] },
  { type: "data", name: "Onest (font)", version: "Google Fonts 2026-11", scope: "required", licenses: [{ license: { id: "OFL-1.1" } }], properties: [{ name: "files", value: "vendor/fonts/*.woff2" }] },
  { type: "framework", name: "Android Gradle Plugin", version: "8.5.2", scope: "excluded", purl: "pkg:maven/com.android.tools.build/gradle@8.5.2", licenses: [{ license: { id: "Apache-2.0" } }], description: "builds the Android wrapper (no runtime libraries; WebView of the phone)" },
  { type: "platform", name: "Supabase (hosted): PostgreSQL 17.11, PostgREST, GoTrue, Realtime", version: "hosted 2026-11", scope: "required", licenses: [{ license: { id: "Apache-2.0" } }, { license: { id: "PostgreSQL" } }], description: "service; open source, self-hostable" },
];
const lock = JSON.parse(fs.readFileSync(path.join(root, "tests", "package-lock.json"), "utf8"));
for (const [k, v] of Object.entries(lock.packages || {})) {
  if (!k.startsWith("node_modules/")) continue;
  const name = k.slice(13).replace(/.*node_modules\//, ""); let lic = v.license;
  if (!lic) { try { lic = JSON.parse(fs.readFileSync(path.join(root, "tests", k, "package.json"), "utf8")).license; } catch (e) {} }
  comps.push({ type: "library", name, version: v.version, scope: "excluded", purl: "pkg:npm/" + name.replace("@", "%40") + "@" + v.version, licenses: lic ? [{ expression: String(lic) }] : [], description: "tests only" + (v.dev ? " (dev)" : ""), hashes: v.integrity ? [{ alg: "SHA-512", content: Buffer.from(v.integrity.replace(/^sha512-/, ""), "base64").toString("hex") }] : undefined });
}
for (const wf of fs.readdirSync(path.join(root, ".github", "workflows"))) {
  const t = fs.readFileSync(path.join(root, ".github", "workflows", wf), "utf8");
  for (const m of t.matchAll(/uses:\s*([\w.-]+\/[\w.-]+)@([0-9a-f]{40})(?:\s*#\s*(\S+))?/g)) comps.push({ type: "application", name: m[1], version: m[3] || m[2], scope: "excluded", purl: "pkg:github/" + m[1] + "@" + m[2], description: "GitHub Action used by " + wf + " (pinned to commit " + m[2] + ")" });
}
const seen = new Set(), uniq = comps.filter((c) => { const k = c.name + "@" + c.version; if (seen.has(k)) return false; seen.add(k); return true; });
const bom = { bomFormat: "CycloneDX", specVersion: "1.5", serialNumber: "urn:uuid:" + crypto.randomUUID(), version: 1,
  metadata: { timestamp: new Date().toISOString(), component: { type: "application", name: "Mərkəz (Ruqya)", version: fs.readFileSync(path.join(root, "version.txt"), "utf8").trim() }, tools: [{ name: "tools/sbom.js" }] }, components: uniq };
process.stdout.write(JSON.stringify(bom, null, 1) + "\n");

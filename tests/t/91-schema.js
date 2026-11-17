// B-17: the database is fully described by this repository — db/schema_live_*.sql plus the install files equal the
// live structure (fingerprint db/structure_live_*.tsv, taken read-only from the live project) in every part.
const path = require("path"), { execFileSync } = require("child_process");
module.exports = async () => {
  const root = path.join(__dirname, "..", "..");
  execFileSync(process.execPath, [path.join(root, "tools", "schema_check.js"), path.join(root, "db", "structure_live_20261117.tsv"), "54351"], { stdio: "pipe" });
};

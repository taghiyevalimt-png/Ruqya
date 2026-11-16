// database files tested on a real PostgreSQL (PGlite)
const fs = require("fs"), path = require("path");
module.exports = async () => {
  for (const f of fs.readdirSync(path.join(__dirname, "..")).filter((x) => /^sql-.*\.js$/.test(x)).sort()) await require(path.join(__dirname, "..", f))();
};

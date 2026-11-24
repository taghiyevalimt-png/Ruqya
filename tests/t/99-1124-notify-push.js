// 24.11 notifications: the Edge Function «notify» encrypts and signs Web Push itself (supabase/functions/notify/webpush.ts,
// WebCrypto only). Checked in Node (same WebCrypto as Deno): the exact body of RFC 8291 Appendix A; a browser written
// separately with node:crypto decrypts our message; the VAPID JWT is a valid ES256 signature for the push service's
// origin; send() posts aes128gcm with the VAPID header and TTL.
const { execFileSync } = require("child_process"), path = require("path");
const { check } = require("../lib");
module.exports = async () => {
  const out = execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", path.join(__dirname, "..", "push", "check.mts")], { encoding: "utf8" });
  const r = JSON.parse(out.trim().split("\n").pop());
  check(r.rfc, "encryption = RFC 8291 Appendix A exactly: " + r.rfcBody);
  check(r.roundtrip, "a separate browser implementation decrypts the message (record 4096, delimiter 2)");
  check(r.vapid, "VAPID: valid ES256 for the push service's origin, 12 h, https subject");
  check(r.send, "send(): aes128gcm, VAPID header, TTL 3600; 201 = taken");
};

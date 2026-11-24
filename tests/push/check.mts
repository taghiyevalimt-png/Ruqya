// run by tests/t/99-1124-notify-push.js: node --experimental-strip-types tests/push/check.mts
import { encrypt, vapidHeader, b64u, unb64u, send } from "../../supabase/functions/notify/webpush.ts";
import * as nc from "node:crypto";
const out: Record<string, unknown> = {};
// 1) RFC 8291 Appendix A: fixed keys and salt → the exact published body
{
  const uaPub = "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4", auth = "BTBZMqHH6r4Tts7J_aSIgg";
  const asPub = unb64u("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8");
  const priv = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: b64u(asPub.slice(1, 33)), y: b64u(asPub.slice(33)), d: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw", ext: true }, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const pub = await crypto.subtle.importKey("raw", asPub, { name: "ECDH", namedCurve: "P-256" }, true, []);
  const body = await encrypt("When I grow up, I want to be a watermelon", uaPub, auth, { salt: unb64u("DGv6ra1nlYgDCS1FRnbzlw"), keys: { publicKey: pub, privateKey: priv } as CryptoKeyPair });
  out.rfc = b64u(body) === "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN";
  out.rfcBody = b64u(body);
}
// 2) a browser of our own (node:crypto, written separately): decrypts what we send
{
  const ua = nc.createECDH("prime256v1"); ua.generateKeys();
  const uaPub = ua.getPublicKey(), auth = nc.randomBytes(16);
  const msg = JSON.stringify({ title: "Mərkəz", body: "30 dəqiqə sonra seans: 14:00 — Ləman Əliyeva", tag: "r:x" });
  const body = Buffer.from(await encrypt(msg, b64u(uaPub), b64u(auth)));
  const salt = body.subarray(0, 16), rs = body.readUInt32BE(16), idlen = body[20], asPub = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  const shared = ua.computeSecret(asPub);
  const ikm = Buffer.from(nc.hkdfSync("sha256", shared, auth, Buffer.concat([Buffer.from("WebPush: info\0"), uaPub, asPub]), 32));
  const cek = Buffer.from(nc.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(nc.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const d = nc.createDecipheriv("aes-128-gcm", cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16));
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  out.roundtrip = rs === 4096 && idlen === 65 && plain[plain.length - 1] === 2 && plain.subarray(0, plain.length - 1).toString() === msg;
}
// 3) VAPID: a valid ES256 JWT for the push service's origin, verified with node:crypto
{
  const k = nc.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = k.privateKey.export({ format: "jwk" }) as { d: string; x: string; y: string };
  const pub = b64u(Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]));
  const h = await vapidHeader("https://web.push.apple.com/QGuQyavXutnMH", pub, jwk.d, "https://taghiyevalimt-png.github.io/Ruqya/");
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(h)!;
  const claims = JSON.parse(Buffer.from(m[2], "base64url").toString());
  const ok = nc.verify("sha256", Buffer.from(m[1] + "." + m[2]), { key: k.publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(m[3], "base64url"));
  out.vapid = ok && m[4] === pub && claims.aud === "https://web.push.apple.com" && claims.exp > Date.now() / 1000 && /^https:/.test(claims.sub);
  // 4) send(): the request a push service gets
  let seen: { url: string; h: Record<string, string>; len: number } | null = null;
  const ua = nc.createECDH("prime256v1"); ua.generateKeys();
  const st = await send({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", p256dh: b64u(ua.getPublicKey()), auth: b64u(nc.randomBytes(16)) }, "{}", { public: pub, private: jwk.d, subject: "https://x.example/" },
    (async (url: string, init: RequestInit) => { seen = { url, h: init.headers as Record<string, string>, len: (init.body as Uint8Array).length }; return new Response(null, { status: 201 }); }) as unknown as typeof fetch);
  out.send = st === 201 && seen!.h["Content-Encoding"] === "aes128gcm" && /^vapid t=/.test(seen!.h["Authorization"]) && seen!.h["TTL"] === "3600" && seen!.len > 86;
}
console.log(JSON.stringify(out));

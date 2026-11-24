// Web Push without libraries: VAPID (RFC 8292, ES256 JWT) and message encryption «aes128gcm» (RFC 8291 + RFC 8188),
// with the platform's WebCrypto only (the same in Deno and Node 22) — tested by tests/t/99-1124-notify-push.js.

const enc = new TextEncoder();

export function b64u(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function unb64u(s: string): Uint8Array {
  const t = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const r = atob(t), out = new Uint8Array(r.length);
  for (let i = 0; i < r.length; i++) out[i] = r.charCodeAt(i);
  return out;
}
function cat(...parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8));
}

// the VAPID «Authorization» header for one push service (its origin), valid 12 hours
export async function vapidHeader(endpoint: string, pub: string, priv: string, subject: string): Promise<string> {
  const p = unb64u(pub);
  const jwk = { kty: "EC", crv: "P-256", x: b64u(p.slice(1, 33)), y: b64u(p.slice(33, 65)), d: priv, ext: true };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(head + "." + body));
  return "vapid t=" + head + "." + body + "." + b64u(sig) + ", k=" + pub;
}

// the encrypted body for one browser (its p256dh public key and auth secret); salt and the sender's key pair are new each time
export async function encrypt(payload: string, p256dh: string, auth: string, fixed?: { salt: Uint8Array; keys: CryptoKeyPair }): Promise<Uint8Array> {
  const uaPub = unb64u(p256dh), authSecret = unb64u(auth);
  const keys = fixed?.keys ?? await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, keys.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, cat(enc.encode("WebPush: info\0"), uaPub, asPub), 32);
  const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const k = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const plain = cat(enc.encode(payload), new Uint8Array([2]));   // one record, the last one: delimiter 0x02, no padding
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, k, plain));
  const rs = new Uint8Array([0, 0, 16, 0]);   // record size 4096
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

// send one message; resolves with the push service's status (201 = taken; 404/410 = this browser is gone)
export async function send(m: { endpoint: string; p256dh: string; auth: string }, payload: string,
  vapid: { public: string; private: string; subject: string }, fetcher: typeof fetch = fetch): Promise<number> {
  const body = await encrypt(payload, m.p256dh, m.auth);
  const r = await fetcher(m.endpoint, {
    method: "POST",
    headers: { "Authorization": await vapidHeader(m.endpoint, vapid.public, vapid.private, vapid.subject),
      "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", "TTL": "3600", "Urgency": "high" },
    body,
  });
  try { await r.arrayBuffer(); } catch (_) { /* nothing to read */ }
  return r.status;
}

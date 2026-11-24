// «notify» — called every minute by pg_cron (sql/2026-11-notify-cron.sql) with the header x-ruqya-cron.
// It asks the database what to send now (public.ruqya_notify_due checks the secret; each notice is claimed once),
// sends each message to the browser's push service (Web Push, encrypted), and forgets browsers that are gone.
// No secret lives here: the database holds the keys; this function only passes the header through.
import { send } from "./webpush.ts";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function rpc(fn: string, args: Record<string, unknown>) {
  const r = await fetch(URL_ + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers: { "apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(fn + " " + r.status);
  return t ? JSON.parse(t) : null;
}

Deno.serve(async (req: Request) => {
  const secret = req.headers.get("x-ruqya-cron") || "";
  if (!secret) return new Response("no", { status: 401 });
  let due: { vapid: { public: string; private: string; subject: string }; msgs: Array<{ endpoint: string; p256dh: string; auth: string; title: string; body: string; tag: string }> };
  try { due = await rpc("ruqya_notify_due", { p_secret: secret }); }
  catch (_) { return new Response("no", { status: 401 }); }
  const gone: string[] = [];
  let ok = 0, fail = 0;
  await Promise.all(due.msgs.map(async (m) => {
    try {
      const st = await send(m, JSON.stringify({ title: m.title, body: m.body, tag: m.tag }), due.vapid);
      if (st === 404 || st === 410) gone.push(m.endpoint);
      else if (st >= 200 && st < 300) ok++;
      else fail++;
    } catch (_) { fail++; }
  }));
  if (gone.length) { try { await rpc("ruqya_push_gone", { p_secret: secret, p_endpoints: gone }); } catch (_) { /* next time */ } }
  return new Response(JSON.stringify({ sent: ok, failed: fail, gone: gone.length }), { headers: { "Content-Type": "application/json" } });
});

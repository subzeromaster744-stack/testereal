// Cloudflare Pages Function: /api/state
// Guarda a escala num banco D1 (binding "DB"). Código de acesso opcional em ACCESS_KEY.
//
// Tabela única: kv(k, v)
//   k = 'cfg'            -> máquinas e colaboradores (JSON)
//   k = 'day:AAAA-MM-DD' -> escala/presença de um dia (JSON)
//   k = 'ver'            -> contador de versão; o site só baixa os dados se ele mudou

const MAX_BYTES = 800_000;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const same = (a, b) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

let ready = null;
const init = (db) =>
  (ready ||= db
    .prepare('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)')
    .run()
    .catch((e) => {
      ready = null;
      throw e;
    }));

const put = (db, k, v) =>
  db.prepare('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind(k, v);

const bump = (db) =>
  db
    .prepare(
      "INSERT INTO kv (k, v) VALUES ('ver', '1') ON CONFLICT(k) DO UPDATE SET v = CAST(CAST(v AS INTEGER) + 1 AS TEXT)"
    );

export async function onRequest({ request, env }) {
  if (!env.DB) return json({ error: 'storage_not_configured' }, 503);

  if (env.ACCESS_KEY && !same(request.headers.get('x-key') || '', String(env.ACCESS_KEY))) {
    return json({ error: 'unauthorized' }, 401);
  }

  try {
    await init(env.DB);

    if (request.method === 'GET') {
      const ver = (await env.DB.prepare("SELECT v FROM kv WHERE k = 'ver'").first('v')) || '0';
      if (new URL(request.url).searchParams.get('v') === ver) return json({ same: true, v: ver });

      const { results } = await env.DB.prepare("SELECT k, v FROM kv WHERE k != 'ver'").all();
      let cfg = null;
      const days = {};
      for (const row of results || []) {
        try {
          if (row.k === 'cfg') cfg = JSON.parse(row.v);
          else if (row.k.startsWith('day:')) days[row.k.slice(4)] = JSON.parse(row.v);
        } catch {
          /* linha corrompida: ignora */
        }
      }
      return json({ v: ver, cfg, days });
    }

    if (request.method === 'POST') {
      let b;
      try {
        b = await request.json();
      } catch {
        return json({ error: 'bad_request' }, 400);
      }
      const payload = JSON.stringify(b && b.data);
      if (!payload || payload.length > MAX_BYTES) return json({ error: 'bad_request' }, 400);

      let key;
      if (b.t === 'cfg' && b.data && typeof b.data === 'object') key = 'cfg';
      else if (b.t === 'day' && /^\d{4}-\d{2}-\d{2}$/.test(b.date) && b.data && typeof b.data === 'object')
        key = 'day:' + b.date;
      else return json({ error: 'bad_request' }, 400);

      await env.DB.batch([put(env.DB, key, payload), bump(env.DB)]);
      return json({ ok: true });
    }

    return json({ error: 'method_not_allowed' }, 405);
  } catch (e) {
    return json({ error: 'server_error' }, 500);
  }
}

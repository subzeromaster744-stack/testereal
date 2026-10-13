// Cloudflare Worker: serve o site (pasta public/) e a API, que guarda a escala num banco D1
// (binding "DB").
//
// Acesso:
//  - ACCESS_KEY (Secret, opcional) é o código do ADMINISTRADOR: vê e altera tudo.
//  - Com ACCESS_KEY definido, o administrador pode criar USUÁRIOS DE SEÇÃO (login e senha). Eles só
//    veem e alteram as seções que o administrador liberou; isso é conferido AQUI, no servidor.
//  - Sem ACCESS_KEY o site fica aberto a quem tiver o endereço (e não dá para criar usuários).
//
// Rotas: /api/state (dados), /api/login (entrar), /api/users (só administrador).
//
// Tabela única: kv(k, v)
//   k = 'cfg'            -> máquinas e colaboradores (JSON)
//   k = 'day:AAAA-MM-DD' -> escala/presença de um dia (JSON)
//   k = 'ver'            -> contador de versão; o site só baixa os dados se ele mudou
//   k = 'users'          -> usuários de seção (nunca vai para o site)
//   k = 'lim:...'        -> contagem de tentativas de entrada erradas

import { filterCfg, filterDay, mergeCfg, mergeDay } from './scope.js';
import { hashPw, newSalt, makeToken, readToken, same, randId, ITER } from './auth.js';

const MAX_BYTES = 800_000;
const WINDOW_MS = 10 * 60 * 1000; // janela da contagem de tentativas erradas
const MAX_IP = 30; // erros por IP na janela
const MAX_USER = 8; // erros por usuário na janela

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

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
  db.prepare(
    "INSERT INTO kv (k, v) VALUES ('ver', '1') ON CONFLICT(k) DO UPDATE SET v = CAST(CAST(v AS INTEGER) + 1 AS TEXT)"
  );

const getRow = (db, k) => db.prepare('SELECT v FROM kv WHERE k = ?').bind(k).first('v');
const parse = (s) => {
  try {
    return s == null ? null : JSON.parse(s);
  } catch {
    return null;
  }
};

// Grava uma linha só se ninguém a mudou desde a leitura (tenta de novo se mudou).
// fn recebe o valor atual e devolve o novo valor (ou null para não gravar).
async function update(db, key, fn) {
  for (let i = 0; i < 5; i++) {
    const old = await getRow(db, key);
    const next = fn(parse(old));
    if (next == null) return false;
    const v = JSON.stringify(next);
    if (v.length > MAX_BYTES) throw new Error('too_big');
    const r =
      old == null
        ? await db.prepare('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO NOTHING').bind(key, v).run()
        : await db.prepare('UPDATE kv SET v = ? WHERE k = ? AND v = ?').bind(v, key, old).run();
    if (r.meta && r.meta.changes === 1) {
      await bump(db).run();
      return true;
    }
  }
  throw new Error('busy');
}

// ---- usuários
const loadUsers = async (db) => {
  const x = parse(await getRow(db, 'users'));
  return x && Array.isArray(x.list) ? x.list : [];
};
const saveUsers = (db, list) => db.batch([put(db, 'users', JSON.stringify({ list })), bump(db)]);
const pub = (u) => ({ id: u.id, name: u.name, login: u.login, sections: u.sections });

// ---- limite de tentativas erradas
async function blocked(db, k, max) {
  const x = parse(await getRow(db, k));
  return !!x && Date.now() - x.t < WINDOW_MS && x.n >= max;
}
async function fails(db, k) {
  const x = parse(await getRow(db, k)),
    now = Date.now(),
    live = !!x && now - x.t < WINDOW_MS;
  await put(db, k, JSON.stringify({ n: live ? x.n + 1 : 1, t: live ? x.t : now })).run();
}
const ipKey = (request) => 'lim:ip:' + (request.headers.get('cf-connecting-ip') || 'x');

// Quem está chamando? { role:'admin', open? } | { role:'user', user } | { err: 429 } | null
async function who(request, env, db) {
  const key = request.headers.get('x-key') || '',
    tok = request.headers.get('x-token') || '';
  if (env.ACCESS_KEY) {
    if (key) {
      if (same(key, String(env.ACCESS_KEY))) return { role: 'admin' };
      if (await blocked(db, ipKey(request), MAX_IP)) return { err: 429 };
      await fails(db, ipKey(request));
    }
    if (tok) {
      const t = await readToken(String(env.ACCESS_KEY), tok);
      const u = t && (await loadUsers(db)).find((x) => x.id === t.id && x.pv === t.pv);
      if (u) return { role: 'user', user: u };
    }
    return null;
  }
  // Sem ACCESS_KEY o site é aberto. Se já existem usuários e o código foi removido, bloqueia tudo
  // (sem a chave não dá para conferir sessões, e abrir tudo seria pior).
  if ((await loadUsers(db)).length) return null;
  return { role: 'admin', open: true };
}

const meOf = (w, env) =>
  w.role === 'user'
    ? { role: 'user', uid: w.user.id, name: w.user.name, sections: w.user.sections }
    : { role: 'admin', open: !!w.open, canUsers: !w.open && !!env.ACCESS_KEY };

const denied = (w) => (w && w.err ? json({ error: 'too_many' }, 429) : json({ error: 'unauthorized' }, 401));

async function state(request, env) {
  if (!env.DB) return json({ error: 'storage_not_configured' }, 503);
  const db = env.DB;
  try {
    await init(db);
    const w = await who(request, env, db);
    if (!w || w.err) return denied(w);
    const me = meOf(w, env),
      secs = w.role === 'user' ? w.user.sections : null;

    if (request.method === 'GET') {
      const ver = (await getRow(db, 'ver')) || '0';
      if (new URL(request.url).searchParams.get('v') === ver) return json({ same: true, v: ver, me });

      const { results } = await db.prepare("SELECT k, v FROM kv WHERE k = 'cfg' OR k LIKE 'day:%'").all();
      let cfg = null;
      const days = {};
      for (const row of results || []) {
        try {
          if (row.k === 'cfg') cfg = JSON.parse(row.v);
          else days[row.k.slice(4)] = JSON.parse(row.v);
        } catch {
          /* linha corrompida: ignora */
        }
      }
      if (secs) {
        const full = cfg || { machines: [], employees: [] };
        cfg = filterCfg(full, secs);
        for (const k of Object.keys(days)) days[k] = filterDay(days[k], full, secs);
      }
      return json({ v: ver, cfg, days, me });
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

      if (!secs) {
        await db.batch([put(db, key, payload), bump(db)]);
        return json({ ok: true });
      }

      // usuário de seção: o que ele enviou é mesclado ao que já existe, só no que ele pode mexer
      let dropped = 0,
        bad = false;
      if (key === 'cfg') {
        await update(db, 'cfg', (cur) => {
          const r = mergeCfg(cur, b.data, secs, w.user.id);
          if (!r) {
            bad = true;
            return null;
          }
          dropped = r.dropped;
          return r.cfg;
        });
      } else {
        const cfg = parse(await getRow(db, 'cfg')) || { machines: [], employees: [] };
        await update(db, key, (cur) => {
          const r = mergeDay(cur, b.data, cfg, secs);
          dropped = r.dropped;
          return r.day;
        });
      }
      return bad ? json({ error: 'bad_request' }, 400) : json({ ok: true, dropped });
    }

    return json({ error: 'method_not_allowed' }, 405);
  } catch (e) {
    return e && e.message === 'busy'
      ? json({ error: 'busy' }, 503)
      : e && e.message === 'too_big'
        ? json({ error: 'bad_request' }, 400)
        : json({ error: 'server_error' }, 500);
  }
}

// Entrar: { code } (administrador) ou { login, password } (usuário de seção)
async function login(request, env) {
  if (!env.DB) return json({ error: 'storage_not_configured' }, 503);
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!env.ACCESS_KEY) return json({ error: 'login_disabled' }, 400);
  const db = env.DB;
  try {
    await init(db);
    let b;
    try {
      b = await request.json();
    } catch {
      return json({ error: 'bad_request' }, 400);
    }
    if (!b || typeof b !== 'object') return json({ error: 'bad_request' }, 400);
    const ik = ipKey(request);
    if (await blocked(db, ik, MAX_IP)) return json({ error: 'too_many' }, 429);

    if (typeof b.code === 'string') {
      if (same(b.code, String(env.ACCESS_KEY))) return json({ ok: true, me: { role: 'admin', canUsers: true } });
      await fails(db, ik);
      return json({ error: 'invalid' }, 401);
    }

    const lg = String(b.login || '').trim().toLowerCase(),
      pw = String(b.password || '').slice(0, 200);
    const u = (await loadUsers(db)).find((x) => x.login === lg);
    const uk = u ? 'lim:u:' + u.id : null;
    if (uk && (await blocked(db, uk, MAX_USER))) return json({ error: 'too_many' }, 429);
    // calcula o hash mesmo quando o usuário não existe, para o tempo de resposta não revelar isso
    const h = await hashPw(pw, u ? u.salt : 'AAAAAAAAAAAAAAAAAAAAAA==', u ? u.it : ITER);
    if (u && same(h, u.hash)) {
      if (uk) await db.prepare('DELETE FROM kv WHERE k = ?').bind(uk).run();
      return json({ ok: true, token: await makeToken(String(env.ACCESS_KEY), u), me: meOf({ role: 'user', user: u }, env) });
    }
    await fails(db, ik);
    if (uk) await fails(db, uk);
    return json({ error: 'invalid' }, 401);
  } catch {
    return json({ error: 'server_error' }, 500);
  }
}

const txt = (x, n) => String(x ?? '').trim().slice(0, n);

// Cadastro de usuários de seção (só o administrador, e só com ACCESS_KEY definido)
async function users(request, env) {
  if (!env.DB) return json({ error: 'storage_not_configured' }, 503);
  const db = env.DB;
  try {
    await init(db);
    const w = await who(request, env, db);
    if (!w || w.err) return denied(w);
    if (w.role !== 'admin') return json({ error: 'forbidden' }, 403);
    if (w.open || !env.ACCESS_KEY) return json({ error: 'access_key_required' }, 400);
    let list = await loadUsers(db);

    if (request.method === 'GET') return json({ users: list.map(pub) });
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    let b;
    try {
      b = await request.json();
    } catch {
      return json({ error: 'bad_request' }, 400);
    }
    if (!b || typeof b !== 'object') return json({ error: 'bad_request' }, 400);

    if (b.act === 'del') {
      if (!list.some((u) => u.id === b.id)) return json({ error: 'not_found' }, 404);
      list = list.filter((u) => u.id !== b.id);
    } else if (b.act === 'save') {
      const name = txt(b.name, 60),
        login = txt(b.login, 30).toLowerCase(),
        pw = typeof b.password === 'string' ? b.password : '',
        secs = [...new Set((Array.isArray(b.sections) ? b.sections : []).map((s) => txt(s, 80)).filter(Boolean))].slice(0, 20);
      const cur = b.id ? list.find((u) => u.id === b.id) : null;
      if (b.id && !cur) return json({ error: 'not_found' }, 404);
      if (!name) return json({ error: 'bad_name' }, 400);
      if (!/^[a-z0-9._-]{3,30}$/.test(login)) return json({ error: 'bad_login' }, 400);
      if (list.some((u) => u.login === login && (!cur || u.id !== cur.id))) return json({ error: 'login_taken' }, 400);
      if (!secs.length) return json({ error: 'bad_sections' }, 400);
      if ((!cur || pw) && (pw.length < 6 || pw.length > 100)) return json({ error: 'bad_password' }, 400);
      const u = { id: cur ? cur.id : randId(8), name, login, sections: secs, salt: cur ? cur.salt : '', hash: cur ? cur.hash : '', it: cur ? cur.it : ITER, pv: cur ? cur.pv : randId(8) };
      if (pw) {
        u.salt = newSalt();
        u.it = ITER;
        u.hash = await hashPw(pw, u.salt, u.it);
        u.pv = randId(8); // encerra as sessões abertas com a senha antiga
      }
      list = cur ? list.map((x) => (x.id === cur.id ? u : x)) : [...list, u];
    } else return json({ error: 'bad_request' }, 400);

    await saveUsers(db, list);
    return json({ ok: true, users: list.map(pub) });
  } catch {
    return json({ error: 'server_error' }, 500);
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/state' || pathname === '/api/state/') return state(request, env);
    if (pathname === '/api/login' || pathname === '/api/login/') return login(request, env);
    if (pathname === '/api/users' || pathname === '/api/users/') return users(request, env);
    if (pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404);
    // Fora de /api/ quem responde são os arquivos de public/ (run_worker_first só chama o Worker em /api/*).
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
  },
};

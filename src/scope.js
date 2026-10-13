// Escopo por seção: o que um usuário restrito VÊ (filtros) e como o que ele GRAVA é mesclado
// ao que já está salvo. Tudo aqui é função pura (sem banco), para poder ser testada isolada.
//
// Regras:
//  - O usuário enxerga só as máquinas das suas seções e as pessoas treinadas nelas, mais as
//    pessoas sem nenhuma máquina (para poderem ser alocadas).
//  - Numa pessoa que também é treinada em outra seção, ele vê e mexe só nas máquinas da sua
//    seção ("compartilhada": nome, turno e remoção ficam bloqueados).
//  - Máquinas novas ficam sempre numa seção do usuário; um CT que já existe em outra seção não
//    pode ser criado de novo.
//  - Na escala do dia, ele só mexe em quem está (ou vai ficar) numa máquina da sua seção.

const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const txt = (x, n) => String(x ?? '').trim().slice(0, n);
const LIM = 5000;

const secOf = (m) => String((m && m.sec) || '');
const uniq = (l) => [...new Set(l)];
const arr = (x) => (Array.isArray(x) ? x : []);

function context(cfg, secs) {
  const A = new Set(arr(secs).map(String));
  const ms = arr(cfg && cfg.machines);
  return { A, valid: new Set(ms.map((m) => m.id)), mine: new Set(ms.filter((m) => A.has(secOf(m))).map((m) => m.id)) };
}

// ms: máquinas que existem; inMine: as da seção do usuário; shared: tem máquina fora da seção
function info(e, cx) {
  const ms = arr(e.machines).filter((i) => cx.valid.has(i));
  const inMine = ms.filter((i) => cx.mine.has(i));
  return { ms, inMine, orphan: ms.length === 0, shared: ms.length > inMine.length };
}
const seen = (x) => x.orphan || x.inMine.length > 0;

// máquina onde a pessoa trabalha no dia (igual ao site: a escolhida, senão a primeira); '' = sem máquina
function wkOf(e, day, cx) {
  const vm = arr(e.machines).filter((i) => cx.valid.has(i));
  const w = day && day.w ? day.w[e.id] : undefined;
  return vm.includes(w) ? w : vm[0] || '';
}

export function filterCfg(cfg, secs) {
  const cx = context(cfg, secs);
  const machines = arr(cfg && cfg.machines).filter((m) => cx.A.has(secOf(m)));
  const employees = [];
  for (const e of arr(cfg && cfg.employees)) {
    const x = info(e, cx);
    if (!seen(x)) continue;
    const { machine, ...rest } = e;
    employees.push({ ...rest, machines: x.inMine, shared: x.shared });
  }
  return { machines, employees };
}

// Dia visto pelo usuário: só quem trabalha numa máquina da seção (ou sem máquina).
// "ox" lista as pessoas visíveis que já estão escaladas em outra seção neste dia.
export function filterDay(day, cfg, secs) {
  if (!isObj(day)) return day;
  const cx = context(cfg, secs), emp = new Map(arr(cfg && cfg.employees).map((e) => [e.id, e]));
  const out = { s: [], a: {}, m: {}, w: {}, ox: [] }, done = new Set();
  for (const id of arr(day.s)) {
    const e = emp.get(id);
    if (!e || done.has(id)) continue;
    done.add(id);
    if (!seen(info(e, cx))) continue;
    const w = wkOf(e, day, cx);
    if (w !== '' && !cx.mine.has(w)) { out.ox.push(id); continue; }
    out.s.push(id);
    const a = day.a && day.a[id];
    if (a === 'p' || a === 'f') out.a[id] = a;
    if (day.m && day.m[id]) out.m[id] = 1;
    const dw = day.w && day.w[id];
    if (typeof dw === 'string' && cx.mine.has(dw)) out.w[id] = dw;
  }
  return out;
}

// Grava a escala de um dia vinda de um usuário restrito, mexendo só no que ele pode.
export function mergeDay(cur, sub, cfg, secs) {
  const cx = context(cfg, secs), emp = new Map(arr(cfg && cfg.employees).map((e) => [e.id, e]));
  const C = isObj(cur) ? cur : {}, Cs = arr(C.s).filter((x) => typeof x === 'string');
  const out = { ...C, s: uniq(Cs), a: { ...(C.a || {}) }, m: { ...(C.m || {}) }, w: { ...(C.w || {}) } };
  const Ss = new Set(arr(sub && sub.s).filter((x) => typeof x === 'string')), was0 = new Set(Cs);
  let dropped = 0;
  for (const id of new Set([...Cs, ...Ss])) {
    const e = emp.get(id);
    if (!e) continue;
    const x = info(e, cx), was = was0.has(id), now = Ss.has(id);
    if (!seen(x)) { if (now && !was) dropped++; continue; } // pessoa de outra seção
    const wasW = wkOf(e, C, cx);
    if (was && wasW !== '' && !cx.mine.has(wasW)) { if (now) dropped++; continue; } // já escalada em outra seção
    if (now) {
      const w = sub.w && typeof sub.w[id] === 'string' ? sub.w[id] : undefined, target = x.ms.includes(w) ? w : x.ms[0] || '';
      if (target !== '' && !cx.mine.has(target)) { dropped++; continue; } // máquina de outra seção
      if (!was) out.s.push(id);
      out.w[id] = target;
      const a = sub.a && sub.a[id];
      if (a === 'p' || a === 'f') out.a[id] = a; else delete out.a[id];
      if (sub.m && sub.m[id]) out.m[id] = 1; else delete out.m[id];
    } else if (was) {
      out.s = out.s.filter((i) => i !== id);
      delete out.a[id]; delete out.m[id]; delete out.w[id];
    }
  }
  return { day: out, dropped };
}

const clampShift = (v, d) => { const n = parseInt(v, 10); return n >= 1 && n <= 3 ? n : d; };

// Grava o cadastro vindo de um usuário restrito. Devolve null se o formato for inválido.
export function mergeCfg(cur, sub, secs, uid) {
  if (!isObj(sub) || !Array.isArray(sub.machines) || !Array.isArray(sub.employees)) return null;
  if (sub.machines.length > LIM || sub.employees.length > LIM) return null;
  const C = isObj(cur) ? cur : {}, Cm = arr(C.machines), Ce = arr(C.employees);
  const A = new Set(arr(secs).map(String)), first = arr(secs)[0];
  let dropped = 0;

  // ---- máquinas: as de outras seções ficam como estão; as da seção seguem o que o usuário enviou
  const subM = new Map();
  for (const m of sub.machines) if (isObj(m) && typeof m.id === 'string' && m.id && m.id.length <= 40 && !subM.has(m.id)) subM.set(m.id, m);
  const cids = new Set(Cm.map((m) => m.id));
  const otherCt = new Set(Cm.filter((m) => !A.has(secOf(m)) && m.ct).map((m) => String(m.ct).toLowerCase()));
  const clean = (m, sec) => ({ id: m.id, name: txt(m.name, 60) || txt(m.ct, 40), ct: txt(m.ct, 40), sec, proc: txt(m.proc, 80) || 'Outros', slots: Math.min(99, Math.max(1, parseInt(m.slots, 10) || 1)) });
  const machines = [];
  for (const m of Cm) {
    if (!A.has(secOf(m))) { machines.push(m); continue; }
    const s = subM.get(m.id);
    if (!s) continue; // o usuário removeu a máquina
    subM.delete(m.id);
    const c = clean(s, A.has(txt(s.sec, 80)) ? txt(s.sec, 80) : secOf(m));
    if (!c.name) { machines.push(m); dropped++; continue; }
    if (c.ct && otherCt.has(c.ct.toLowerCase())) { machines.push(m); dropped++; continue; } // CT de outra seção
    machines.push(c);
  }
  for (const [id, s] of subM) {
    if (cids.has(id)) { dropped++; continue; } // id de máquina de outra seção
    const c = clean(s, A.has(txt(s.sec, 80)) ? txt(s.sec, 80) : first);
    if (!c.name || (c.ct && otherCt.has(c.ct.toLowerCase()))) { dropped++; continue; }
    machines.push(c);
  }

  // ---- colaboradores
  const valid = new Set(machines.map((m) => m.id));
  const mineAfter = new Set(machines.filter((m) => A.has(secOf(m))).map((m) => m.id));
  const cxB = context(C, secs), mineBefore = cxB.mine;
  const prune = (l) => uniq(arr(l).filter((i) => valid.has(i)));
  const subE = new Map();
  for (const e of sub.employees) if (isObj(e) && typeof e.id === 'string' && e.id && e.id.length <= 40 && !subE.has(e.id)) subE.set(e.id, e);
  const cemp = new Set(Ce.map((e) => e.id));
  const employees = [];
  for (const e of Ce) {
    const x = info(e, cxB);
    if (!seen(x)) { employees.push({ ...e, machines: prune(e.machines) }); continue; } // não é da seção: intacta
    const s = subE.get(e.id);
    subE.delete(e.id);
    const canDel = !x.shared && (!x.orphan || (!!e.cb && e.cb === uid));
    if (!s) { // o usuário tirou a pessoa da lista
      if (canDel) continue;
      if (x.shared) employees.push({ ...e, machines: prune(arr(e.machines).filter((i) => !mineBefore.has(i))) }); // só sai das máquinas da seção
      else { employees.push({ ...e, machines: prune(e.machines) }); dropped++; } // sem máquina e de outra pessoa: fica
      continue;
    }
    const want = uniq(arr(s.machines).filter((i) => mineAfter.has(i)));
    const keep = prune(arr(e.machines).filter((i) => !mineBefore.has(i) && !mineAfter.has(i)));
    const head = arr(e.machines)[0], machines2 = keep.includes(head) ? [...keep, ...want] : [...want, ...keep];
    let name = e.name, shift = e.shift;
    if (!x.shared) { name = txt(s.name, 80) || e.name; shift = clampShift(s.shift, e.shift); }
    else if (txt(s.name, 80) !== e.name || clampShift(s.shift, e.shift) !== e.shift) dropped++;
    employees.push({ ...e, name, shift, machines: machines2 });
  }
  for (const [id, s] of subE) {
    if (cemp.has(id)) { dropped++; continue; } // id de pessoa de outra seção
    const name = txt(s.name, 80);
    if (!name || employees.length >= LIM) { dropped++; continue; }
    employees.push({ id, name, shift: clampShift(s.shift, 1), machines: uniq(arr(s.machines).filter((i) => mineAfter.has(i))), cb: uid });
  }
  return { cfg: { ...C, machines, employees }, dropped };
}

// Senhas e sessões dos usuários de seção. Só usa a Web Crypto do próprio Worker (sem bibliotecas).
//  - Senha: PBKDF2-SHA256 com sal aleatório por usuário (guarda sal, número de voltas e o resultado).
//  - Sessão: token assinado com HMAC (chave derivada do ACCESS_KEY): "idDoUsuário.expira.pv.assinatura".
//    "pv" muda quando a senha é trocada, o que invalida as sessões antigas daquele usuário.

const enc = new TextEncoder();

export const ITER = 20000;
export const SESSION_DAYS = 14;

const b64 = (buf) => {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s);
};
const b64url = (buf) => b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const same = (a, b) => {
  a = String(a);
  b = String(b);
  let d = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
};

export const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
export const randId = (n = 8) => {
  const al = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(rand(n), (b) => al[b % al.length]).join('');
};

export async function hashPw(pw, saltB64, iter = ITER) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(pw)), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations: iter }, key, 256));
}

export const newSalt = () => b64(rand(16));

async function sign(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode('escala-he:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

export async function makeToken(secret, user, now = Date.now()) {
  const body = `${user.id}.${Math.floor(now / 1000) + SESSION_DAYS * 86400}.${user.pv}`;
  return `${body}.${await sign(secret, body)}`;
}

// devolve { id, pv } se a assinatura e a validade estiverem corretas; senão null
export async function readToken(secret, tok, now = Date.now()) {
  const p = String(tok || '').split('.');
  if (p.length !== 4 || !/^[a-z0-9]+$/.test(p[0]) || !/^\d+$/.test(p[1]) || !/^[a-z0-9]+$/.test(p[2])) return null;
  if (!same(p[3], await sign(secret, p.slice(0, 3).join('.')))) return null;
  if (+p[1] * 1000 < now) return null;
  return { id: p[0], pv: p[2] };
}

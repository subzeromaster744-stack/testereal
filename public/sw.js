// Service worker do aplicativo (PWA).
// - A API (/api/*) NUNCA passa pelo cache: os dados vêm sempre do servidor.
// - A página usa "rede primeiro": quando há internet, vem a versão mais nova publicada;
//   sem internet (ou se a rede demorar mais de 4 s), abre a última cópia guardada.
// - Ícones e manifesto: cache primeiro.
const V = 'escala-he-v1';
const SHELL = ['/', '/manifest.json', '/icon.svg', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(V)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  const u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== self.location.origin || u.pathname.startsWith('/api/')) return;

  if (r.mode === 'navigate') {
    const net = fetch(r).then((res) => {
      if (res.ok && !res.redirected) {
        const cp = res.clone();
        caches.open(V).then((c) => c.put('/', cp));
      }
      return res;
    });
    e.waitUntil(net.catch(() => {}));
    const lento = new Promise((_, no) => setTimeout(no, 4000));
    e.respondWith(Promise.race([net, lento]).catch(() => caches.match('/').then((h) => h || net)));
    return;
  }

  e.respondWith(
    caches.match(r).then(
      (h) =>
        h ||
        fetch(r).then((res) => {
          if (res.ok) {
            const cp = res.clone();
            caches.open(V).then((c) => c.put(r, cp));
          }
          return res;
        })
    )
  );
});

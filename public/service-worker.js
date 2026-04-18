const CACHE = 'familyboard-v1';
const CORE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API: 네트워크 우선, 실패 시 캐시(읽기 전용 엔드포인트에 한해)
  if (url.pathname.startsWith('/api/')) {
    const readable = ['/api/weather', '/api/air', '/api/fx', '/api/birthdays/soon'];
    if (readable.some((p) => url.pathname.startsWith(p))) {
      e.respondWith(
        fetch(req).then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return r;
        }).catch(() => caches.match(req))
      );
    }
    return; // 그 외 API는 캐시 안 함
  }

  // 정적: 캐시 우선
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((r) => {
      if (r.ok && url.origin === location.origin) {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return r;
    }).catch(() => caches.match('/index.html')))
  );
});

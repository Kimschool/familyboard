// 테스트 중: SW 역할을 자기 소멸로 바꿈. 기존 클라이언트의 캐시까지 비운 뒤 언레지스터.
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.navigate(c.url));
    await self.registration.unregister();
  })());
});
// 모든 fetch 를 네트워크로 통과시킴 (캐시 참조 금지)
self.addEventListener('fetch', () => {});

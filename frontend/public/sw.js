/* 말랑말랑 서비스워커: 연습 알림(Web Push) + 인터넷 없을 때 배우기·소리 지도 보기 */
const CACHE = 'malang-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// 네트워크 먼저, 안 되면 마지막으로 받은 것 (화면 · 소리 레슨 · 오늘의 학습)
const CACHEABLE_API = /\/api\/(sounds|items|plan\/today|exercises|review)/;
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CACHEABLE_API.test(url.pathname)) return;
  if (sameOrigin && url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('/offline') : Response.error()))),
  );
});

// 소리 대신 진동과 화면으로 알린다
self.addEventListener('push', (e) => {
  let data = { title: '말랑말랑', body: '오늘의 학습을 이어서 해요', url: '/home' };
  try {
    data = { ...data, ...e.data.json() };
  } catch (_) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [120, 60, 120],
      data: { url: data.url },
      tag: 'malang-reminder',
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/home';
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((list) => {
      for (const c of list) if ('focus' in c) return c.navigate(url).then(() => c.focus());
      return self.clients.openWindow(url);
    }),
  );
});

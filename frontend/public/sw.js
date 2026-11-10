/* 말랑말랑 서비스워커: 연습 알림(Web Push) + 인터넷 없을 때 배우기·소리 지도 보기 */
const CACHE = 'malang-v1';
const PRE = 'malang-pre-';

// 설치할 때 화면 껍데기와 JS·CSS를 미리 받아 둔다 (public/precache.json, 빌드 때 생성).
// 몇 개가 실패해도 설치는 끝낸다 → 나머지는 쓸 때 저장.
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    fetch('/precache.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(async (m) => {
        if (!m) return;
        const c = await caches.open(PRE + m.version);
        for (let i = 0; i < m.urls.length; i += 8) {
          await Promise.all(m.urls.slice(i, i + 8).map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => undefined)));
        }
      })
      .catch(() => undefined),
  );
});
// 새 빌드가 오면 이전 미리 받기 캐시를 지운다
self.addEventListener('activate', (e) =>
  e.waitUntil(
    (async () => {
      const m = await fetch('/precache.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (m) for (const k of await caches.keys()) if (k.startsWith(PRE) && k !== PRE + m.version) await caches.delete(k);
      await self.clients.claim();
    })(),
  ),
);

// 네트워크 먼저, 안 되면 마지막으로 받은 것 (화면 · 소리 레슨 · 오늘의 학습)
const CACHEABLE_API = /\/api\/(sounds|items|plan\/today|exercises|review)/;
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CACHEABLE_API.test(url.pathname)) return;
  if (sameOrigin && url.pathname.startsWith('/api/')) return;
  // 이름에 해시가 붙은 JS·CSS·글꼴은 바뀌지 않으니 저장된 것 먼저
  if (sameOrigin && url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        // 화면 이동은 주소의 ?쿼리를 빼고도 찾아본다 (예: /practice/...?sound=ㅅ)
        caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('/offline') : Response.error())),
      ),
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

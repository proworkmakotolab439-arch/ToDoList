const CACHE_NAME = 'team-todo-v5';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/db.js',
  './js/calendar.js',
  './js/app.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // ネットワーク優先（Network First）、失敗時（オフライン時）にキャッシュを利用
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // レスポンスをキャッシュに保存（GETリクエストのみ）
        if (e.request.method === 'GET' && res.status === 200) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

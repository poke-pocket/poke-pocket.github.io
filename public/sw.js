const CACHE_NAME = 'poke-pocket-pwa-v1';
const CORE_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never interfere with Vite dev HMR endpoints
  if (url.pathname.startsWith('/@') || url.pathname.startsWith('/src/') || url.pathname.startsWith('/node_modules/')) {
    return;
  }

  // Navigation requests: Network-first with offline fallback to cached index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  // Static sprites, icons & built assets: Cache-first with background refresh
  if (
    url.pathname.startsWith('/sprites/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const net = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || net;
      }),
    );
  }
});

/* Service Worker basique pour PWA — cache des assets statiques, pas d'API */
const CACHE_NAME = 'fph-static-v2';
const ASSET_ALLOWLIST = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSET_ALLOWLIST)).catch(() => undefined)
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ne jamais gérer ni mettre en cache les appels API
  if (url.pathname.startsWith('/api/')) return;

  // Même origine seulement
  if (url.origin !== self.location.origin) return;

  // Méthodes non-GET non gérées
  if (req.method !== 'GET') return;

  // Stratégie: Network First, fallback Cache pour la SPA et assets
  event.respondWith(
    fetch(req).then((res) => {
      // Mettre en cache les réponses valides
      const copy = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => undefined);
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || (url.pathname === '/' ? caches.match('/index.html') : undefined)))
  );
});

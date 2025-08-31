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
  event.respondWith((async () => {
    const isNavigate = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
    try {
      const res = await fetch(req);
      // Mettre en cache les réponses valides
      try {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, res.clone());
      } catch (_) {
        // ignore cache errors
      }
      return res;
    } catch (err) {
      // Fallback navigation -> index.html pour routes SPA (/login, /instructor/players, ...)
      if (isNavigate) {
        const indexCached = await caches.match('/index.html');
        if (indexCached) return indexCached;
      }
      // Sinon, tenter le cache de la ressource
      const cached = await caches.match(req);
      if (cached) return cached;
      // Toujours renvoyer une Response valide
      return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});

// --- Web Push: affichage des notifications ---
self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : null;
    if (!data) return;
    const { title, body, icon, actions = [], clickUrl } = data;
    const options = {
      body,
      icon,
      actions: actions.map((a) => ({ action: a.action || 'open', title: a.title || 'Ouvrir' })),
      data: { clickUrl, actions },
    };
    event.waitUntil(self.registration.showNotification(title || 'Notification', options));
  } catch (_) {
    // do nothing
  }
});

// Clic sur la notification ou une action
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification && event.notification.data || {};
  let targetUrl = data.clickUrl || '/';
  if (event.action && Array.isArray(data.actions)) {
    const found = data.actions.find((a) => a.action === event.action);
    if (found && found.url) targetUrl = found.url;
  }
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const same = allClients.find((c) => c.url === targetUrl);
    if (same) return same.focus();
    return clients.openWindow(targetUrl);
  })());
});

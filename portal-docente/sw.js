const CACHE_NAME = 'portal-docente-v1';

const urlsToCache = [
  '/portal-docente/',
  '/portal-docente/index.html',
  '/portal-docente/styles.css',
  '/portal-docente/app.js',
  '/portal-docente/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Solo interceptar rutas del portal docente
  if (!url.pathname.startsWith('/portal-docente/')) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(fetchResponse => {
        // Cachear recursos nuevos del portal-docente
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, fetchResponse.clone());
          return fetchResponse;
        });
      });
    }).catch(() => {
      // Fallback offline: devolver index si es navegación
      if (event.request.mode === 'navigate') {
        return caches.match('/portal-docente/index.html');
      }
    })
  );
});

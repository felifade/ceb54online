// Service Worker — Portal Administrativo CEB 5/4
// Estrategia: network-first para HTML/JS/CSS (código siempre fresco),
// cache-first solo para fuentes e imágenes estáticas.
// Los requests a GAS (script.google.com) nunca se cachean.

const CACHE = 'admin-v1';
const STATIC = [
  '/admin/',
  '/admin/index.html',
  '/admin/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Nunca interceptar requests a GAS o dominios externos
  if (url.hostname !== self.location.hostname) return;
  if (e.request.method !== 'GET') return;

  // Solo manejar rutas del portal admin
  if (!url.pathname.startsWith('/admin/')) return;

  // Para JS/CSS/HTML: network-first (código siempre fresco, fallback a caché)
  const isAsset = /\.(js|css|html)(\?|$)/.test(url.pathname);
  if (isAsset) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Para imágenes/fuentes: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

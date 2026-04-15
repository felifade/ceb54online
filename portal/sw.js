/* ============================================================
   Service Worker – Portal CEB 5/4
   Scope: /portal/
   Estrategia: Cache-first para assets estáticos locales.
               Pass-through para APIs externas y Google Sheets.
   ============================================================ */

const CACHE_NAME = 'portal-ceb54-v1';

/* Archivos locales que se pre-cachean al instalar */
const PRECACHE_URLS = [
  '/portal/',
  '/portal/index.html',
  '/portal/alumno.html',
  '/portal/padre.html',
  '/portal/css/portal.css',
  '/portal/js/portal-api.js',
  '/portal/js/alumno.js',
  '/portal/js/padre.js',
  '/portal/js/prefectura-portal.js',
  '/portal/js/pwa.js',
  '/portal/manifest.json'
];

/* Dominios externos que NUNCA se cachean */
const BYPASS_PATTERNS = [
  'script.google.com',
  'sheets.googleapis.com',
  'googleapis.com',
  'google.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'unpkg.com',
  'cdn.',
  'cloudflare'
];

// ── Instalación: pre-caché de assets estáticos ──────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // addAll falla silenciosamente por recurso si usamos Promise.allSettled
      return Promise.allSettled(
        PRECACHE_URLS.map(url => cache.add(url).catch(() => null))
      );
    })
  );
  self.skipWaiting(); // Activa el SW inmediatamente
});

// ── Activación: limpia caches viejos ────────────────────────
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
  self.clients.claim(); // Toma control de todas las pestañas
});

// ── Fetch: intercepta solo recursos del portal ──────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // 1. Solo interceptar rutas dentro del portal
  if (!url.includes('/portal/')) return;

  // 2. Dejar pasar APIs externas sin caché
  if (BYPASS_PATTERNS.some(pattern => url.includes(pattern))) return;

  // 3. Solo cachear GET
  if (event.request.method !== 'GET') return;

  // 4. Cache-first → network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(networkResponse => {
        // Cachear el recurso nuevo para visitas futuras
        if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return networkResponse;
      });
    }).catch(() => {
      // Offline fallback: devuelve index.html del portal si está en caché
      if (url.includes('.html') || url.endsWith('/portal/') || url.endsWith('/portal')) {
        return caches.match('/portal/index.html');
      }
    })
  );
});

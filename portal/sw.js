/* ============================================================
   Service Worker – Portal CEB 5/4
   Scope: /portal/
   Estrategia:
     • HTML / JS / CSS  → network-first (siempre intenta fresco;
       cae a caché solo si está offline). Evita que dispositivos
       queden atorados en versiones viejas.
     • Imágenes / fonts / manifest → cache-first (carga rápido).
     • APIs externas (Google Sheets/Script) → pass-through (sin caché).
   ============================================================ */

const CACHE_NAME = 'portal-ceb54-v3';  // ⚠️ Bumpear al desplegar cambios

/* Archivos locales que se pre-cachean al instalar (mínimo viable) */
const PRECACHE_URLS = [
  '/portal/',
  '/portal/index.html',
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

/* ── Instalación: pre-caché mínimo + activación inmediata ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        PRECACHE_URLS.map(url => cache.add(url).catch(() => null))
      )
    )
  );
  self.skipWaiting(); // ← el SW nuevo toma control sin esperar cierre de pestañas
});

/* ── Activación: borrar caches viejos + tomar control ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Detección del tipo de recurso ── */
function isHtmlOrCode(url) {
  // HTML, JS, CSS — siempre queremos lo más fresco posible
  if (/\.html(\?|$)/.test(url)) return true;
  if (/\.js(\?|$)/.test(url))   return true;
  if (/\.css(\?|$)/.test(url))  return true;
  // Rutas que sirven HTML por default
  if (url.endsWith('/portal/') || url.endsWith('/portal')) return true;
  return false;
}

/* ── Estrategias ── */
async function networkFirst(request) {
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    if (fresh && fresh.status === 200 && fresh.type !== 'opaque') {
      const clone = fresh.clone();
      caches.open(CACHE_NAME).then(c => c.put(request, clone));
    }
    return fresh;
  } catch (err) {
    // Offline: caer al caché
    const cached = await caches.match(request);
    if (cached) return cached;
    // Último fallback: index del portal
    if (request.url.includes('.html') || request.url.endsWith('/portal/')) {
      const indexCached = await caches.match('/portal/index.html');
      if (indexCached) return indexCached;
    }
    throw err;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.status === 200 && fresh.type !== 'opaque') {
      const clone = fresh.clone();
      caches.open(CACHE_NAME).then(c => c.put(request, clone));
    }
    return fresh;
  } catch (err) {
    throw err;
  }
}

/* ── Fetch: enrutar según tipo de recurso ── */
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // 1. Solo interceptar rutas dentro del portal
  if (!url.includes('/portal/')) return;

  // 2. Dejar pasar APIs externas sin caché
  if (BYPASS_PATTERNS.some(pattern => url.includes(pattern))) return;

  // 3. Solo cachear GET
  if (event.request.method !== 'GET') return;

  // 4. Estrategia según tipo
  if (isHtmlOrCode(url)) {
    event.respondWith(networkFirst(event.request));
  } else {
    event.respondWith(cacheFirst(event.request));
  }
});

/* ── Mensaje desde la página: forzar actualización ── */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});

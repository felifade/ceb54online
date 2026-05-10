// Service Worker — Consultor Director
// Cache-first para assets estáticos + network-first para JSON (catalog/index)
// Permite consultar offline tras la primera visita.

const VERSION = "v14";
const CACHE_STATIC = `cd-static-${VERSION}`;
const CACHE_DATA = `cd-data-${VERSION}`;

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./buscar.html",
  "./lector.html",
  "./leer.html",
  "./consultor.html",
  "./mis-notas.html",
  "./simulacro.html",
  "./estudiar.html",
  "./css/director.css?v=10",
  "./js/app.js?v=1",
  "./js/search.js?v=1",
  "./js/reader.js?v=3",
  "./js/leer.js?v=4",
  "./js/chat.js?v=4",
  "./js/simulacro.js?v=2",
  "./js/estudiar.js?v=2",
  "./js/storage.js?v=3",
  "./js/drive-sync.js?v=2",
  "./js/bookmark.js?v=1",
  "./js/mis-notas.js?v=2",
  "./js/markdown.js?v=2",
  "./js/summary-editor.js?v=2",
  "./js/summary-marker.js?v=1",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((c) => c.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => !k.endsWith(VERSION)).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // No interferir con Drive / fonts / esm.sh — que vayan a la red.
  if (url.origin !== location.origin) return;

  // Datos JSON (catalog + search-index): network-first con fallback a caché
  if (url.pathname.endsWith(".json")) {
    event.respondWith(
      fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_DATA).then((c) => c.put(req, clone)).catch(()=>{});
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Assets estáticos: cache-first
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && (url.pathname.endsWith(".css") || url.pathname.endsWith(".js") ||
                     url.pathname.endsWith(".html"))) {
        const clone = res.clone();
        caches.open(CACHE_STATIC).then((c) => c.put(req, clone)).catch(()=>{});
      }
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});

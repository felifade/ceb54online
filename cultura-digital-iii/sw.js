// Service Worker — Cuaderno Cultura Digital III
// Cache-first para todo lo del cuaderno (HTML, CSS, visuales).
// Tras la primera visita online, el cuaderno funciona sin conexión.

const VERSION = "v20260515";
const CACHE_STATIC = `cd3-static-${VERSION}`;

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./assets/visuales/semana-11/calendario-eventos.html",
  "./assets/visuales/semana-12/estructura-drive.html",
  "./assets/visuales/semana-13/notas-keep.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((c) =>
      Promise.all(STATIC_ASSETS.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => null)))
    )
    .then(() => self.skipWaiting())
    .catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys
        .filter(k => k.startsWith("cd3-") && !k.endsWith(VERSION))
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // No interferir con Drive, GAS, fonts u otros orígenes.
  if (url.origin !== location.origin) return;

  // Solo tomamos cargo de rutas dentro de /cultura-digital-iii/.
  if (!url.pathname.includes("/cultura-digital-iii/") && url.pathname !== "/cultura-digital-iii") return;

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE_STATIC).then((c) => c.put(req, clone)).catch(()=>{});
        }
        return res;
      }).catch(() => {
        if (req.mode === "navigate") {
          return caches.match("./index.html");
        }
        return Response.error();
      });
    })
  );
});

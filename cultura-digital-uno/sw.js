// Service Worker — Cuaderno Cultura Digital II
// Cache-first para todo lo del cuaderno (HTML, CSS, visuales, imágenes).
// Tras la primera visita online, el cuaderno funciona sin conexión.
// La integración con docente2 (iframe) y los videos de Drive siguen
// requiriendo red — esos van a otro origen y el SW no los toca.

const VERSION = "v20260521";
const CACHE_STATIC = `cd2-static-${VERSION}`;

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css?v=20260509",
  "./img/guia_app_inventor.png",
  "./assets/visuales/semana-09/interfaz-registro-tareas.html",
  "./assets/visuales/semana-11/bloques-guardar.html",
  "./assets/visuales/semana-11/bloques-join.html",
  "./assets/visuales/semana-11/tabla-capturas.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((c) =>
      // Usamos { cache: 'reload' } para que el install NO consuma respuestas cacheadas.
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
        .filter(k => k.startsWith("cd2-") && !k.endsWith(VERSION))
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // No interferir con Drive, GAS, fonts, lucide u otros orígenes.
  if (url.origin !== location.origin) return;

  // Solo tomamos cargo de rutas que viven dentro de /cultura-digital/.
  // (Si el sitio raíz tuviera su propio SW, no nos pisamos.)
  if (!url.pathname.includes("/cultura-digital/") && url.pathname !== "/cultura-digital") return;

  // Cache-first con relleno bajo demanda.
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
        // Si todo falla y la ruta es navegación, devolver el index del cuaderno
        if (req.mode === "navigate") {
          return caches.match("./index.html");
        }
        return Response.error();
      });
    })
  );
});

/* public/pro-sw.js
 * Service worker de la PWA de profesionales (scope /pro). Más prudente que el
 * de pacientes (mi-sw.js): NUNCA guarda pantallas. La agenda tiene datos de
 * pacientes y cambia a cada rato; una copia vieja mostrada sin conexión podría
 * hacer que alguien espere a un paciente que canceló, y en un celular perdido
 * quedaría a la vista. Sin red se muestra solo la página de "sin conexión".
 */

const VERSION = "pro-v1";
const CACHE = `${VERSION}-offline`;
const OFFLINE_URL = "/pro-offline.html";
const ASSETS = [OFFLINE_URL, "/web-app-manifest-192x192.png", "/web-app-manifest-512x512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(ASSETS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith("pro-") && key !== CACHE).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch {
        const cache = await caches.open(CACHE);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      }
    })()
  );
});

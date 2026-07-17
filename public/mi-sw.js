/* public/mi-sw.js
 * Service worker de la PWA de pacientes (scope /mi). Implementación manual, sin
 * dependencias. Estrategia:
 *   - Shell (rutas de las 4 tabs + assets propios): stale-while-revalidate.
 *   - Navegaciones que fallan sin cache: fallback a la página offline.
 *   - Todo /api/* y datos por-paciente: network-only, nunca se cachean
 *     (las páginas son force-dynamic; ver AUDIT-PWA · RIESGOS-11).
 *   - Cross-origin y no-GET: se dejan pasar sin interceptar.
 *
 * Nota: el shell HTML puede contener datos del paciente; el cache es por
 * dispositivo. Al cerrar sesión conviene limpiar estos caches (fuera del alcance
 * de estas fundaciones).
 */

const VERSION = "mi-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const OFFLINE_URL = "/mi-offline.html";

// Navegaciones a precachear (las 4 tabs). Requieren sesión: se guardan solo si
// responden 200 durante la instalación (que ocurre en una página /mi ya autenticada).
const SHELL_ROUTES = ["/mi", "/mi/agenda", "/mi/pagos", "/mi/biblioteca"];

// Assets propios (públicos, siempre 200). También se sirven con SWR.
const SHELL_ASSETS = [
  OFFLINE_URL,
  "/mi/manifest.webmanifest",
  "/web-app-manifest-192x192.png",
  "/web-app-manifest-512x512.png",
];
const SHELL_ASSET_SET = new Set(SHELL_ASSETS);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Críticos y públicos: si alguno falla, que falle la instalación.
      await cache.addAll(SHELL_ASSETS);
      // Shell de las tabs: tolerante a fallos, solo respuestas 200.
      await Promise.allSettled(
        SHELL_ROUTES.map(async (url) => {
          try {
            const res = await fetch(url, { credentials: "same-origin" });
            if (res && res.ok) await cache.put(url, res.clone());
          } catch {
            /* sin conexión o sin sesión en install: se cachea luego al navegar */
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

// Actualización inmediata si la página lo pide (para futuros flujos de update).
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Solo GET; las mutaciones nunca se interceptan.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cross-origin: dejar pasar (p. ej. checkout de ONVO).
  if (url.origin !== self.location.origin) return;

  // API y datos por-paciente: network-only, nunca cache.
  if (url.pathname.startsWith("/api/")) return;

  // Navegaciones (documentos): SWR con fallback offline.
  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  // Assets propios del shell: stale-while-revalidate.
  if (SHELL_ASSET_SET.has(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event));
  }
  // El resto (p. ej. /_next/static con hash) lo maneja el navegador.
});

function revalidate(cache, request) {
  return fetch(request)
    .then((res) => {
      if (res && res.ok && res.type === "basic") cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(event.request);
  const networked = revalidate(cache, event.request);

  if (cached) {
    event.waitUntil(networked);
    return cached;
  }
  const res = await networked;
  return res || Response.error();
}

async function handleNavigation(event) {
  const cache = await caches.open(SHELL_CACHE);
  // ignoreSearch: una tab con ?query distinta reutiliza el shell cacheado.
  const cached = await cache.match(event.request, { ignoreSearch: true });
  const networked = revalidate(cache, event.request);

  if (cached) {
    event.waitUntil(networked);
    return cached;
  }
  const res = await networked;
  if (res) return res;

  const offline = await cache.match(OFFLINE_URL);
  return offline || Response.error();
}

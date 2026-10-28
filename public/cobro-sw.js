/* public/cobro-sw.js
 * Service worker de la app de cobros PALIG (scope /panel/palig/cobro).
 *
 * Hace una sola cosa: recibir el comprobante que se comparte desde WhatsApp o
 * la app del banco (share_target del manifest). Lo guarda un momento en el
 * Cache Storage del celular y abre la app, que lo lee y lo borra enseguida.
 * No cachea páginas ni datos: todo lo demás va directo a la red.
 */

const CACHE = "cobro-compartido";
const ACCION = "/panel/palig/cobro/compartir";
const CLAVE = "/panel/palig/cobro/compartido";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || url.pathname !== ACCION) return;
  event.respondWith((async () => {
    const volver = (estado) => Response.redirect(new URL(`/panel/palig/cobro?compartido=${estado}`, self.location.origin).href, 303);
    try {
      const form = await event.request.formData();
      const archivo = form.get("comprobante");
      if (!archivo || typeof archivo === "string") return volver("error");
      const cache = await caches.open(CACHE);
      await cache.put(CLAVE, new Response(archivo, {
        headers: { "Content-Type": archivo.type || "application/octet-stream", "X-Nombre": encodeURIComponent(archivo.name || "comprobante") },
      }));
      return volver("1");
    } catch {
      return volver("error");
    }
  })());
});

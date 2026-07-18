// src/lib/mi/logout-cleanup.js
// Limpieza best-effort al cerrar sesión: da de baja la suscripción push del
// dispositivo y vacía el cache del service worker de /mi (relevante en
// dispositivos compartidos, para que el próximo paciente no herede el shell
// cacheado ni notificaciones del anterior).
//
// Es un no-op silencioso fuera del scope de /mi: si la página actual no está
// controlada por mi-sw.js (navigator.serviceWorker.controller ausente), no hay
// nada que limpiar — cubre logins de ADMIN/PROFESSIONAL y cualquier página del
// sitio público sin necesidad de guards adicionales.
export async function cleanupPushAndServiceWorker() {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (!navigator.serviceWorker.controller) return; // no hay SW de /mi activo en esta página

    const registration = await navigator.serviceWorker.ready;

    if ("pushManager" in registration) {
      const subscription = await registration.pushManager.getSubscription().catch(() => null);
      if (subscription) {
        // keepalive: sobrevive a la navegación que dispara el propio logout.
        fetch("/api/mi/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          keepalive: true,
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch(() => {});
        subscription.unsubscribe().catch(() => {});
      }
    }

    registration.active?.postMessage({ type: "CLEAR_CACHES" });
  } catch {
    // Nunca debe impedir el logout.
  }
}

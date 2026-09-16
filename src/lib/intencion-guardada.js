// src/lib/intencion-guardada.js
//
// La migaja que sobrevive al correo de verificación.
//
// Entre crear el usuario y poder reservar hay que confirmar el correo, y ese
// enlace abre una pestaña nueva: la dirección que traía la reserva —el `next`
// que veníamos pasando de pantalla en pantalla— no viaja en el correo. Sin esto,
// quien confirma su cuenta aterriza en un ingreso pelado y tiene que volver a
// buscar al profesional, el servicio, el día y la hora.
//
// Es una migaja y no una promesa: vive en el navegador de quien se registró, así
// que si abre el correo en el teléfono y se había registrado en la computadora,
// no está. Por eso nada depende de ella; lo único que hace es acortar el camino
// cuando el correo se abre donde uno esperaría.
//
// Al leerla se vuelve a validar con `leerIntencion`: lo que salga de acá termina
// en un `router.push`, y el contenido de `localStorage` lo puede escribir
// cualquier cosa que haya corrido en este origen.

import { leerIntencion } from "@/lib/intencion-de-agenda";

const CLAVE = "smcr:intencion-de-agenda";

export function guardarIntencion(next) {
  if (!leerIntencion(next)) return;
  try {
    window.localStorage.setItem(CLAVE, String(next));
  } catch {
    // Modo privado, almacenamiento bloqueado o lleno. No es un error que
    // alguien tenga que ver: el camino largo sigue funcionando.
  }
}

/** La intención guardada, ya validada, o `null`. */
export function leerIntencionGuardada() {
  try {
    const guardada = window.localStorage.getItem(CLAVE);
    return leerIntencion(guardada) ? guardada : null;
  } catch {
    return null;
  }
}

export function olvidarIntencion() {
  try {
    window.localStorage.removeItem(CLAVE);
  } catch {
    // Ídem: nada que hacer si el navegador no deja tocar el almacenamiento.
  }
}

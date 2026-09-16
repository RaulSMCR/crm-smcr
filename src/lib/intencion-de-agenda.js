// src/lib/intencion-de-agenda.js
//
// Qué cita estaba por reservar alguien que todavía no tiene cuenta.
//
// Para agendar hace falta usuario, y el usuario recién creado hace falta
// verificarlo por correo. Entre el horario que alguien eligió y la cita
// confirmada hay entonces tres pantallas ajenas —registro, aviso de
// verificación, ingreso— y en cada una se puede perder lo que la persona venía
// a hacer. Antes se perdía: el botón de confirmar mandaba a `/ingresar` sin
// decir por qué, y quien volvía tenía que buscar de nuevo al profesional, el
// servicio, el día y la hora.
//
// La intención viaja en el `next` que ya usaban el ingreso y el registro, y es
// una ruta de esta misma aplicación, no un objeto opaco: se puede leer en la
// barra de direcciones, sobrevive a un correo abierto en otra pestaña y, si
// alguien la edita, lo peor que pasa es que se ignore.
//
// Lógica pura: arma la ruta, la lee y la sabe decir en palabras.

import { CR_TZ, formatSelectedLabel, instanteDeHoraCR } from "@/lib/appointment-slots";

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const idValido = (valor) => ID.test(String(valor || ""));
const horaValida = (valor) => HORA.test(String(valor || ""));

/**
 * Una fecha con forma de fecha **y** que existe en el calendario.
 *
 * La forma no alcanza: `2026-13-40` pasa el patrón y produce una fecha
 * inválida, y esto termina en `Intl.DateTimeFormat`, que ante eso lanza. Como
 * la etiqueta se arma también en el servidor —al pintar el registro y el
 * ingreso—, una dirección escrita a mano tiraba la página entera. Se comprueba
 * en UTC, que es donde la cuenta no depende del reloj de quien la haga.
 */
function fechaValida(valor) {
  const texto = String(valor || "");
  if (!FECHA.test(texto)) return false;
  const [año, mes, dia] = texto.split("-").map(Number);
  const fecha = new Date(Date.UTC(año, mes - 1, dia));
  return fecha.getUTCFullYear() === año && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

/**
 * La ruta que devuelve a esta reserva tal como estaba.
 *
 * El día y la hora van solo si los dos son válidos: media reserva no sirve para
 * reabrir nada y ensucia la barra de direcciones.
 *
 * @returns {string|null} `/agendar/<id>?serviceId=…&fecha=…&hora=…`
 */
export function rutaDeReserva({ professionalId, serviceId, fecha, hora } = {}) {
  if (!idValido(professionalId)) return null;

  const params = new URLSearchParams();
  if (idValido(serviceId)) params.set("serviceId", String(serviceId));
  if (fechaValida(fecha) && horaValida(hora)) {
    params.set("fecha", String(fecha));
    params.set("hora", String(hora));
  }

  const query = params.toString();
  return `/agendar/${professionalId}${query ? `?${query}` : ""}`;
}

/**
 * El par día/hora que llega por la barra de direcciones, si es que llega entero.
 *
 * Los dos o ninguno: una fecha sin hora no reabre ningún horario, y dejarla
 * pasar haría que la agenda se posicionara en un día que la persona no eligió.
 */
export function horarioPedido(fecha, hora) {
  const completo = fechaValida(fecha) && horaValida(hora);
  return { fecha: completo ? String(fecha) : null, hora: completo ? String(hora) : null };
}

/**
 * Lee un `next` y devuelve la reserva que había detrás.
 *
 * Devuelve `null` para cualquier otra ruta —incluida una absoluta a otro
 * sitio— porque esto termina en un `href` y en un texto en pantalla: lo que no
 * se reconoce no se muestra.
 */
export function leerIntencion(next) {
  const ruta = String(next || "");
  if (!ruta.startsWith("/") || ruta.startsWith("//")) return null;

  let url;
  try {
    url = new URL(ruta, "https://saludmentalcostarica.com");
  } catch {
    return null;
  }

  const partes = url.pathname.split("/").filter(Boolean);
  if (partes.length !== 2 || partes[0] !== "agendar") return null;
  if (!idValido(partes[1])) return null;

  const serviceId = url.searchParams.get("serviceId");
  const fecha = url.searchParams.get("fecha");
  const hora = url.searchParams.get("hora");
  const conHorario = fechaValida(fecha) && horaValida(hora);

  return {
    professionalId: partes[1],
    serviceId: idValido(serviceId) ? serviceId : null,
    fecha: conHorario ? fecha : null,
    hora: conHorario ? hora : null,
  };
}

/**
 * El horario elegido, en palabras y en hora de Costa Rica.
 *
 * En hora tica y no en la del visitante a propósito: es la que muestran las
 * pestañas de días y los botones de la agenda, y es la que va a leer el
 * profesional. Dos relojes distintos para la misma cita, en pantallas
 * seguidas, es exactamente lo que hace dudar de si uno agendó lo que quería.
 */
export function etiquetaDelHorario(fecha, hora) {
  if (!fechaValida(fecha) || !horaValida(hora)) return null;
  return formatSelectedLabel(instanteDeHoraCR(fecha, hora), CR_TZ);
}

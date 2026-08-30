// src/lib/lugar-cita.js
//
// Dónde es la cita, dicho completo y en un solo lugar.
//
// Antes el paciente veía nada más el rótulo del lugar —"Moravia", "Consultorio
// Escazú"— que nombra la zona pero no dice a dónde ir. La dirección estaba
// guardada en la cita desde el momento de agendar y no se mostraba en ninguna
// pantalla ni en ningún correo. Quien reservaba tenía que preguntar.
//
// Las tres modalidades se resuelven distinto y por eso viven juntas:
//
//   • OFFICE  — la dirección del consultorio, con las señas de cómo llegar.
//   • HOME    — la dirección la pone el paciente: es su casa, no hay nada que
//               decirle que él no sepa.
//   • VIRTUAL — no hay dirección; lo que hace falta es saber cuándo llega el
//               enlace, que es lo que la gente pregunta.
//
// Los datos salen de la copia congelada en la cita, no del lugar vivo: si el
// profesional edita o borra el consultorio, la cita ya agendada sigue diciendo
// a dónde se citó a esa persona.

import { modalityLabel } from "@/lib/rates";

export const AVISO_ENLACE_VIRTUAL =
  "El profesional le hará llegar el enlace unos minutos antes de la cita.";

const AVISO_DOMICILIO =
  "El profesional se traslada a la dirección que usted indicó al agendar.";

function limpio(valor) {
  return String(valor || "").trim();
}

/**
 * @param {object} cita  con modality, locationName, locationAddress, locationNotes
 * @returns {{
 *   modalidad: string,        rótulo de la modalidad ("Presencial", "Virtual"…)
 *   titulo: string,           nombre del lugar
 *   direccion: string,        dirección exacta, o "" si la modalidad no tiene
 *   comoLlegar: string,       piso, timbre, señas
 *   aviso: string,            lo que hay que decirle a la persona
 *   esVirtual: boolean,
 *   tieneDireccion: boolean
 * }}
 */
export function detalleLugarCita(cita) {
  const modality = cita?.modality || null;
  const titulo = limpio(cita?.locationName);
  const direccion = limpio(cita?.locationAddress);
  const comoLlegar = limpio(cita?.locationNotes);
  const esVirtual = modality === "VIRTUAL";

  let aviso = "";
  if (esVirtual) aviso = AVISO_ENLACE_VIRTUAL;
  else if (modality === "HOME") aviso = AVISO_DOMICILIO;

  return {
    modalidad: modalityLabel(modality),
    titulo,
    direccion: esVirtual ? "" : direccion,
    comoLlegar: esVirtual ? "" : comoLlegar,
    aviso,
    esVirtual,
    tieneDireccion: Boolean(!esVirtual && direccion),
  };
}

/**
 * Una línea con todo lo del lugar, para el correo y para donde no hay espacio
 * de sobra. Devuelve "" si la cita no tiene lugar registrado, para que quien la
 * use no imprima una etiqueta vacía.
 */
export function lugarCitaEnUnaLinea(cita) {
  const lugar = detalleLugarCita(cita);
  const partes = [
    lugar.titulo,
    lugar.modalidad && lugar.titulo ? `(${lugar.modalidad})` : lugar.modalidad,
    lugar.direccion,
    lugar.comoLlegar,
  ].filter(Boolean);

  return partes.join(" · ");
}

// src/lib/acuerdos-de-atencion.js
//
// Acuerdos de atención: un paciente que se atiende con una periodicidad fija y
// sin fecha de fin. Ver el modelo AcuerdoDeAtencion en prisma/schema.prisma.
//
// Este módulo es puro —sin base ni Google— para que las fechas se puedan probar
// solas. Las fechas se calculan con la MISMA semántica que la regla RRULE que
// recibe Google: si el CRM y el calendario discreparan en una sola sesión, la
// cita existiría en un lado y no en el otro, y nada lo avisaría.
//
// Por eso el mensual sigue la RFC 5545: un acuerdo del día 31 no tiene sesión en
// los meses sin día 31 (Google hace eso), en lugar de correrla al día 30.

import { crAddDays, crParts, instanteDeHoraCR } from "@/lib/appointment-slots";

export const PERIODICIDADES = {
  WEEKLY: "WEEKLY",
  BIWEEKLY: "BIWEEKLY",
  MONTHLY: "MONTHLY",
};

export const ETIQUETA_PERIODICIDAD = {
  WEEKLY: "Cada semana",
  BIWEEKLY: "Cada dos semanas",
  MONTHLY: "Cada mes",
};

export const ESTADOS_ACUERDO = {
  ACTIVO: "ACTIVO",
  TERMINADO: "TERMINADO",
};

/**
 * Cuántas semanas hacia adelante se tienen generadas las citas.
 *
 * Alcanza para que la agenda, la disponibilidad y la facturación vean las
 * próximas sesiones como citas normales, sin crear de golpe un año de registros
 * que habría que mover uno por uno si cambia la hora.
 */
export const SEMANAS_GENERADAS = 8;

/**
 * Slug del profesional gestionado: por decisión de Raúl (2026-10-21) es el único
 * que maneja acuerdos. Repetido y no importado de `pagos-manuales`, que arrastra
 * medio sistema de facturación; que no se separen lo fija la prueba.
 */
export const SLUG_QUE_GESTIONA_ACUERDOS = "raul-olmedo";

export function puedeGestionarAcuerdos(professionalSlug) {
  return professionalSlug === SLUG_QUE_GESTIONA_ACUERDOS;
}

const DIA_MS = 24 * 60 * 60 * 1000;

function hhmm(minutos) {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

function diasDelMes(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Valida lo que el profesional cargó. Devuelve null si está bien, o el mensaje.
 *
 * @param {object} datos
 * @param {Date}   [ahora]
 */
export function problemaDeAcuerdo(datos = {}, ahora = new Date()) {
  if (!Object.values(PERIODICIDADES).includes(datos.periodicidad)) {
    return "Elija la periodicidad: cada semana, cada dos semanas o cada mes.";
  }
  const inicio = new Date(datos.inicio);
  if (Number.isNaN(inicio.getTime())) return "La fecha y hora de la primera sesión no es válida.";
  if (inicio.getTime() <= ahora.getTime()) return "La primera sesión tiene que ser en el futuro.";

  const duracion = Number(datos.duracionMin);
  if (!Number.isInteger(duracion) || duracion < 15 || duracion > 240) {
    return "La duración de la sesión no es válida.";
  }

  const precio = Number(datos.precioAcordado);
  if (!Number.isFinite(precio) || precio <= 0) return "Indique el precio acordado de cada sesión.";

  if (datos.fin) {
    const fin = new Date(datos.fin);
    if (Number.isNaN(fin.getTime())) return "La fecha de fin no es válida.";
    if (fin.getTime() < inicio.getTime()) return "La fecha de fin no puede ser anterior a la primera sesión.";
  }
  return null;
}

/**
 * Las sesiones del acuerdo que empiezan en [desde, hasta).
 *
 * La hora de pared tica de `inicio` se conserva en todas: Costa Rica no cambia
 * de horario, pero calcular por día y hora —y no sumando milisegundos— deja el
 * cálculo correcto aunque eso cambiara.
 *
 * @param {{periodicidad: string, inicio: Date|string, duracionMin: number, fin?: Date|string|null}} acuerdo
 * @param {{desde: Date, hasta: Date}} ventana
 * @returns {{start: Date, end: Date}[]}
 */
export function sesionesDelAcuerdo(acuerdo, { desde, hasta }) {
  const inicio = new Date(acuerdo.inicio);
  const { ymd: ymdInicio, minutes } = crParts(inicio);
  const hora = hhmm(minutes);
  const duracionMs = Number(acuerdo.duracionMin) * 60_000;
  const fin = acuerdo.fin ? new Date(acuerdo.fin) : null;
  const tope = fin && fin.getTime() < hasta.getTime() ? new Date(fin.getTime() + 1) : hasta;

  const sesiones = [];
  const agregar = (ymd) => {
    const start = instanteDeHoraCR(ymd, hora);
    if (start.getTime() >= desde.getTime() && start.getTime() < tope.getTime()) {
      sesiones.push({ start, end: new Date(start.getTime() + duracionMs) });
    }
    return start;
  };

  if (acuerdo.periodicidad === PERIODICIDADES.MONTHLY) {
    const [year, month, day] = ymdInicio.split("-").map(Number);
    for (let k = 0; ; k += 1) {
      const total = month - 1 + k;
      const y = year + Math.floor(total / 12);
      const m = (total % 12) + 1;
      // Primer día del mes: sirve para cortar aunque este mes no tenga sesión.
      if (instanteDeHoraCR(`${y}-${String(m).padStart(2, "0")}-01`, hora).getTime() >= tope.getTime()) break;
      if (day > diasDelMes(y, m)) continue;
      agregar(`${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    }
    return sesiones;
  }

  const paso = acuerdo.periodicidad === PERIODICIDADES.BIWEEKLY ? 14 : 7;
  // Salta directo cerca de `desde` en vez de recorrer desde el inicio: un
  // acuerdo de años tendría cientos de vueltas que no producen nada.
  const saltos = Math.max(0, Math.floor((desde.getTime() - inicio.getTime()) / (paso * DIA_MS)) - 1);
  for (let k = saltos; ; k += 1) {
    const start = agregar(crAddDays(ymdInicio, k * paso));
    if (start.getTime() >= tope.getTime()) break;
  }
  return sesiones;
}

/** Formato básico de la RFC 5545 en UTC: 20261028T220000Z. */
export function fechaRfc5545(date) {
  return new Date(date).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * La regla de repetición que se manda a Google, en la zona America/Costa_Rica.
 * Sin fecha de fin la serie sigue indefinidamente.
 */
export function reglaDeGoogle(acuerdo) {
  const partes =
    acuerdo.periodicidad === PERIODICIDADES.MONTHLY
      ? ["FREQ=MONTHLY"]
      : ["FREQ=WEEKLY", ...(acuerdo.periodicidad === PERIODICIDADES.BIWEEKLY ? ["INTERVAL=2"] : []), "WKST=MO"];
  if (acuerdo.fin) partes.push(`UNTIL=${fechaRfc5545(acuerdo.fin)}`);
  return [`RRULE:${partes.join(";")}`];
}

/**
 * Id de una sesión dentro del evento recurrente de Google.
 *
 * Google nombra cada instancia `<idDelMaestro>_<inicio original en UTC>`. Con
 * esto cada cita apunta a su propia sesión: moverla o cancelarla toca solo esa
 * fecha, y la disponibilidad no la cuenta como un choque contra sí misma.
 */
export function idDeSesionEnGoogle(gcalEventId, start) {
  if (!gcalEventId) return null;
  return `${gcalEventId}_${fechaRfc5545(start)}`;
}

/**
 * Recordatorios: de qué días los programa cada quien.
 *
 * El receptor de recordatorios no descarta duplicados —programar dos veces es
 * mandar dos correos— y QStash limita cuán adelante se puede programar. Así que
 * no se programan al generar la cita (hasta 8 semanas antes) sino por día
 * calendario tico: la tarea diaria, que corre a las 05:00 CR (11:00 UTC en
 * vercel.json), programa las sesiones de PASADO MAÑANA. Cada sesión cae en un
 * solo día, así que se programa una sola vez y con días de margen.
 *
 * Al crear un acuerdo quedan sesiones que la tarea ya no va a cubrir: las de hoy
 * y mañana, y las de pasado mañana si la tarea de hoy ya corrió.
 */
export const DIAS_DE_ANTICIPACION_DE_LA_TAREA = 2;
// En Hobby, Vercel dispara el cron en algún momento de la hora indicada: entre
// las 05:00 y las 05:59 CR. Desde las 06:00 ya corrió seguro. Un acuerdo creado
// entre las 05:00 y las 06:00 podría quedar sin los recordatorios de pasado
// mañana: se acepta, porque el otro error posible es mandarlos dos veces.
const TAREA_YA_CORRIO_DESDE_MIN = 6 * 60;

export function diaQueProgramaLaTarea(ahora = new Date()) {
  return crAddDays(crParts(ahora).ymd, DIAS_DE_ANTICIPACION_DE_LA_TAREA);
}

export function diasQueProgramaLaCreacion(ahora = new Date()) {
  const { ymd, minutes } = crParts(ahora);
  const dias = [ymd, crAddDays(ymd, 1)];
  if (minutes >= TAREA_YA_CORRIO_DESDE_MIN) dias.push(crAddDays(ymd, DIAS_DE_ANTICIPACION_DE_LA_TAREA));
  return dias;
}

/**
 * Qué tramo hay que generar ahora: desde lo último generado (o el inicio, o
 * ahora) hasta SEMANAS_GENERADAS hacia adelante. Null si no hay nada que hacer.
 */
export function ventanaPendiente(acuerdo, ahora = new Date()) {
  if (acuerdo.estado !== ESTADOS_ACUERDO.ACTIVO) return null;
  const hasta = new Date(ahora.getTime() + SEMANAS_GENERADAS * 7 * DIA_MS);
  const candidatos = [new Date(acuerdo.inicio).getTime(), ahora.getTime()];
  if (acuerdo.generadoHasta) candidatos.push(new Date(acuerdo.generadoHasta).getTime() + 1);
  const desde = new Date(Math.max(...candidatos));
  if (desde.getTime() >= hasta.getTime()) return null;
  return { desde, hasta };
}

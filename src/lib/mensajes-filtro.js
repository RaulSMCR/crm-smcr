// src/lib/mensajes-filtro.js
//
// Construcción del filtro de citas para segmentar comunicados. Módulo PURO: no
// toca Prisma, solo arma el objeto `where` y decide si el filtro está activo.
// Separado para poder probar la lógica sin base de datos, que es donde vive el
// riesgo real (una ventana mal armada manda un aviso urgente a quien no toca).

/** Estados de cita agrupados por lo que significan para segmentar. */
export const ESTADOS = {
  // Citas vivas: aún van a ocurrir.
  ACTIVAS: ["PENDING", "CONFIRMED"],
  // Ya ocurrieron, con o sin asistencia.
  OCURRIDAS: ["COMPLETED", "NO_SHOW"],
  // Se cayeron.
  CANCELADAS: ["CANCELLED_BY_USER", "CANCELLED_BY_PRO"],
};

export const VENTANAS = {
  UPCOMING: "UPCOMING", // citas futuras todavía en pie
  PAST: "PAST", // citas que ya pasaron
  ANY: "ANY", // cualquiera, sin mirar la fecha
};

/** Convierte "a,b,c" en ["a","b","c"]; tolera ya recibir un arreglo. */
export function listaDe(valor) {
  if (Array.isArray(valor)) return valor.map((v) => String(v).trim()).filter(Boolean);
  if (!valor) return [];
  return String(valor)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function serializarLista(valores) {
  const limpia = [...new Set(listaDe(valores))];
  return limpia.length ? limpia.join(",") : null;
}

/**
 * ¿Hay filtro de citas? Solo si el admin acotó por profesional, por servicio o
 * por ventana temporal. Sin nada de eso, el comunicado va al conjunto base y no
 * se consultan citas.
 */
export function tieneFiltroDeCitas({ profesionales, servicios, ventana } = {}) {
  return (
    listaDe(profesionales).length > 0 ||
    listaDe(servicios).length > 0 ||
    (Boolean(ventana) && ventana !== VENTANAS.ANY)
  );
}

/** Qué estados de cita cuentan, según la ventana y si se incluyen canceladas. */
export function estadosPara(ventana, incluirCanceladas) {
  const base =
    ventana === VENTANAS.UPCOMING
      ? [...ESTADOS.ACTIVAS]
      : ventana === VENTANAS.PAST
        ? [...ESTADOS.OCURRIDAS]
        : [...ESTADOS.ACTIVAS, ...ESTADOS.OCURRIDAS];

  // Una cita futura cancelada no es "una cita futura": no se suma a UPCOMING
  // aunque se pidan canceladas, porque el aviso de reagenda no le sirve a
  // alguien que ya canceló.
  if (incluirCanceladas && ventana !== VENTANAS.UPCOMING) {
    return [...base, ...ESTADOS.CANCELADAS];
  }
  return base;
}

/**
 * Arma el `where` de Appointment que identifica a los pacientes alcanzados.
 *
 * @returns {object|null} null si no hay filtro de citas que aplicar.
 */
export function construirFiltroDeCitas(
  { profesionales, servicios, ventana, ventanaDias, incluirCanceladas } = {},
  ahora = new Date(),
) {
  if (!tieneFiltroDeCitas({ profesionales, servicios, ventana })) return null;

  const modo = ventana || VENTANAS.ANY;
  const where = { status: { in: estadosPara(modo, Boolean(incluirCanceladas)) } };

  const pros = listaDe(profesionales);
  if (pros.length) where.professionalId = { in: pros };

  const svcs = listaDe(servicios);
  if (svcs.length) where.serviceId = { in: svcs };

  if (modo === VENTANAS.UPCOMING) {
    const desde = ahora;
    if (ventanaDias && Number(ventanaDias) > 0) {
      const hasta = new Date(ahora.getTime());
      hasta.setDate(hasta.getDate() + Number(ventanaDias));
      where.date = { gte: desde, lte: hasta };
    } else {
      where.date = { gte: desde };
    }
  } else if (modo === VENTANAS.PAST) {
    where.date = { lt: ahora };
  }

  return where;
}

/**
 * Describe el filtro en una frase, para que el admin lea a quién le va a llegar
 * antes de enviar y para dejar rastro en el historial.
 */
export function describirFiltro(
  { profesionales, servicios, ventana, ventanaDias, incluirCanceladas, negar } = {},
  nombres = { profesionales: {}, servicios: {} },
) {
  if (!tieneFiltroDeCitas({ profesionales, servicios, ventana })) return null;

  const partes = [];
  const pros = listaDe(profesionales).map((id) => nombres.profesionales?.[id] || id);
  const svcs = listaDe(servicios).map((id) => nombres.servicios?.[id] || id);

  if (pros.length) partes.push(`con ${pros.join(" o ")}`);
  if (svcs.length) partes.push(`en ${svcs.join(" o ")}`);

  const modo = ventana || VENTANAS.ANY;
  if (modo === VENTANAS.UPCOMING) {
    partes.push(ventanaDias ? `con cita en los próximos ${ventanaDias} días` : "con cita futura");
  } else if (modo === VENTANAS.PAST) {
    partes.push("que ya se atendieron");
  }

  if (incluirCanceladas && modo !== VENTANAS.UPCOMING) partes.push("incluyendo canceladas");

  const frase = `agendaron ${partes.join(", ")}`;
  return negar ? `NO ${frase}` : frase;
}

// src/lib/casos-policy.js
// Las reglas del expediente que no tocan la base de datos.
//
// Separado de lib/casos por la misma razón que reenganche-policy lo está de
// reenganche: el formulario de cierre necesita los tipos y sus ayudas, y es un
// componente cliente. Importarlos desde el módulo con Prisma arrastraría el
// cliente de base de datos al bundle del navegador.

export const ESTADOS = Object.freeze({
  ABIERTO: "ABIERTO",
  PENDIENTE_VISADO: "PENDIENTE_VISADO",
  CERRADO: "CERRADO",
});

export const RESULTADOS = Object.freeze({ ALTA: "ALTA", BAJA: "BAJA" });

/** Años que hay que conservar el expediente (CPPCR, arts. 21 y 22). */
export const ANIOS_CONSERVACION = 10;

export const EVENTOS = Object.freeze({
  APERTURA: "APERTURA",
  CIERRE_PROPUESTO: "CIERRE_PROPUESTO",
  VISADO: "VISADO",
  VISADO_DEVUELTO: "VISADO_DEVUELTO",
  REAPERTURA: "REAPERTURA",
  ADENDA: "ADENDA",
  LECTURA_DIRECCION_CLINICA: "LECTURA_DIRECCION_CLINICA",
  COPIA_SOLICITADA: "COPIA_SOLICITADA",
});

/**
 * Los cierres posibles.
 *
 * `resultado` separa lo que para la persona es un logro de lo que es una
 * interrupción, y es lo que se usa para hablarle distinto en su panel.
 */
export const TIPOS_CIERRE = Object.freeze({
  ALTA_POR_OBJETIVOS: {
    label: "Alta por objetivos cumplidos",
    resultado: RESULTADOS.ALTA,
    ayuda: "El proceso llegó a donde se propuso llegar.",
  },
  ALTA_CON_SEGUIMIENTO: {
    label: "Alta con seguimiento",
    resultado: RESULTADOS.ALTA,
    ayuda: "Cierra el proceso activo, con controles espaciados o puerta abierta.",
  },
  BAJA_POR_ABANDONO: {
    label: "Baja por abandono",
    resultado: RESULTADOS.BAJA,
    ayuda: "Dejó de asistir y no respondió a los intentos de contacto.",
    requiereContactos: true,
  },
  BAJA_A_SOLICITUD: {
    label: "Baja a solicitud de la persona",
    resultado: RESULTADOS.BAJA,
    ayuda: "Pidió terminar el proceso.",
  },
  BAJA_POR_DERIVACION: {
    label: "Baja por derivación",
    resultado: RESULTADOS.BAJA,
    ayuda: "Continúa con otro profesional o servicio.",
    requiereReferencia: true,
  },
  BAJA_POR_CRITERIO_PROFESIONAL: {
    label: "Baja por criterio profesional",
    resultado: RESULTADOS.BAJA,
    ayuda: "El encuadre dejó de ser el adecuado para esta persona.",
    requiereReferencia: true,
  },
});

/** Fecha hasta la que hay obligación de conservar el expediente. */
export function fechaDeConservacion(cerradoAt = new Date()) {
  const base = new Date(cerradoAt);
  if (Number.isNaN(base.getTime())) return null;
  const limite = new Date(base);
  limite.setFullYear(limite.getFullYear() + ANIOS_CONSERVACION);
  return limite;
}

/** ¿Ya se puede depurar? Solo si está cerrado y pasó el plazo. */
export function sePuedeDepurar(caso, ahora = new Date()) {
  if (caso?.estado !== ESTADOS.CERRADO || !caso?.conservarHasta) return false;
  return new Date(caso.conservarHasta).getTime() <= new Date(ahora).getTime();
}

const MINIMO_NOTA = 40;

/**
 * Valida una propuesta de cierre.
 *
 * Los mínimos de longitud no son burocracia: una nota de cierre de seis palabras
 * no le sirve a nadie que abra el expediente dentro de cinco años, que es
 * exactamente para quien se escribe.
 *
 * `contactosDeReenganche` se pasa desde afuera para que esto siga siendo una
 * función pura y se pueda probar sin base de datos.
 *
 * @returns {{ok: boolean, error?: string, resultado?: string}}
 */
export function validarCierre({
  tipoCierre,
  evolucion,
  estadoActual,
  recomendaciones,
  referencia,
  contactosDeReenganche = 0,
} = {}) {
  const tipo = TIPOS_CIERRE[tipoCierre];
  if (!tipo) return { ok: false, error: "Elegí un tipo de cierre válido." };

  const texto = (v) => String(v || "").trim();

  if (texto(evolucion).length < MINIMO_NOTA) {
    return { ok: false, error: "Contá cómo evolucionó el proceso, con algo más de detalle." };
  }
  if (texto(estadoActual).length < MINIMO_NOTA) {
    return { ok: false, error: "Describí el estado de la persona al momento del cierre." };
  }
  if (texto(recomendaciones).length < MINIMO_NOTA) {
    return { ok: false, error: "Anotá las recomendaciones o el plan que queda por delante." };
  }
  if (tipo.requiereReferencia && texto(referencia).length < MINIMO_NOTA) {
    return {
      ok: false,
      error: "Indicá a quién se deriva y con qué indicaciones: una derivación sin destino no lo es.",
    };
  }
  // No se da de baja por abandono a quien nadie contactó. Es la diferencia entre
  // constatar un abandono y fabricarlo por omisión.
  if (tipo.requiereContactos && Number(contactosDeReenganche) < 1) {
    return {
      ok: false,
      error:
        "Antes de dar de baja por abandono tiene que quedar registrado al menos un intento de " +
        "contacto. Registralo en la bitácora de reenganche.",
    };
  }

  return { ok: true, resultado: tipo.resultado };
}

/**
 * Cómo se le nombra el estado del proceso a la persona atendida.
 *
 * Nunca se le muestra "BAJA_POR_ABANDONO" ni nada que la clasifique. Un alta se
 * nombra como el logro que es; lo demás se nombra sin adjetivos, y la
 * explicación la da la conversación, no una etiqueta.
 */
export function estadoParaPaciente(caso) {
  if (!caso) return null;

  if (caso.estado !== ESTADOS.CERRADO) {
    return { etiqueta: "En curso", tono: "activo" };
  }
  if (caso.resultado === RESULTADOS.ALTA) {
    return { etiqueta: "Cerrado con alta", tono: "logro" };
  }
  return { etiqueta: "Cerrado", tono: "neutro" };
}

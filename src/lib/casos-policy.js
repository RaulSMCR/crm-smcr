// src/lib/casos-policy.js
// Las reglas del registro administrativo de procesos, sin tocar la base.
//
// Ojo con el nombre: acá no hay expediente. El expediente le pertenece a la
// persona y a su profesional, y conservarlo es obligación del profesional
// colegiado. Lo que se modela acá es cuándo empezó un proceso, cuándo terminó y
// bajo qué categoría, que es la parte que le toca a la plataforma.
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

/**
 * Años que se conserva el registro administrativo.
 *
 * Se eligió el mismo plazo que el CPPCR le exige al profesional para su
 * expediente (arts. 21 y 22), pero es una decisión comercial nuestra: la
 * obligación es de él, no de la plataforma.
 */
export const ANIOS_CONSERVACION = 10;

export const EVENTOS = Object.freeze({
  APERTURA: "APERTURA",
  CIERRE_PROPUESTO: "CIERRE_PROPUESTO",
  VISADO: "VISADO",
  VISADO_DEVUELTO: "VISADO_DEVUELTO",
  REAPERTURA: "REAPERTURA",
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
    // Por definición no se le pudo avisar: exigir lo contrario obligaría a mentir.
    permiteSinAviso: true,
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
    requiereDestino: true,
  },
  BAJA_POR_CRITERIO_PROFESIONAL: {
    label: "Baja por criterio profesional",
    resultado: RESULTADOS.BAJA,
    ayuda: "El encuadre dejó de ser el adecuado para esta persona.",
    requiereDestino: true,
  },
});

/**
 * Hasta cuándo se conserva el registro administrativo.
 *
 * Diez años es una decisión comercial, tomada para que este rastro dure lo mismo
 * que el expediente del profesional. No es la custodia del expediente: esa la
 * lleva él, fuera de esta base.
 */
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

/**
 * Valida una propuesta de cierre.
 *
 * Todo lo que se pide acá son categorías y declaraciones. No hay ningún campo de
 * relato, y no debe agregarse: cómo evolucionó el proceso y cómo llega la
 * persona al cierre son contenido de expediente, y el expediente le pertenece a
 * ella y a su profesional, que es su custodio.
 *
 * Lo que sí se exige es lo que protege a la empresa y al profesional si mañana
 * alguien pregunta por qué se cerró un proceso: que la persona haya sido
 * informada, que el profesional deje constancia de haberlo registrado donde
 * corresponde, y —si es una derivación— a dónde va.
 *
 * `contactosDeReenganche` se pasa desde afuera para que esto siga siendo una
 * función pura y se pueda probar sin base de datos.
 *
 * @returns {{ok: boolean, error?: string, resultado?: string}}
 */
export function validarCierre({
  tipoCierre,
  personaInformada,
  registradoEnExpediente,
  derivadoA,
  contactosDeReenganche = 0,
} = {}) {
  const tipo = TIPOS_CIERRE[tipoCierre];
  if (!tipo) return { ok: false, error: "Elegí un tipo de cierre válido." };

  // El abandono es el único cierre donde no se le pudo avisar a nadie: esa es
  // justamente su definición, y exigir lo contrario obligaría a mentir.
  if (!personaInformada && !tipo.permiteSinAviso) {
    return {
      ok: false,
      error: "Confirmá que la persona fue informada del cierre de su proceso.",
    };
  }

  if (!registradoEnExpediente) {
    return {
      ok: false,
      error:
        "Confirmá que el cierre quedó registrado en tu expediente. Acá se guarda solo el dato " +
        "administrativo; el expediente es tuyo y de la persona.",
    };
  }

  if (tipo.requiereDestino && String(derivadoA || "").trim().length < 3) {
    return { ok: false, error: "Indicá a quién se deriva: una derivación sin destino no lo es." };
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

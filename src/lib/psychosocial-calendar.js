// src/lib/psychosocial-calendar.js
//
// Capa crono-psicosocial del calendario costarricense. Módulo puro: sin Prisma,
// sin React, sin acceso a red. Se importa igual desde servidor y desde cliente.
//
// Fuente: "Matriz Estratégica y Calendario de Salud Mental Costa Rica
// (15 ago 2026 – 14 ago 2027)". Cada marca cita su sección de origen en `fuente`.
//
// Tres reglas de diseño que conviene no romper:
//
//   1. Las fechas son strings 'YYYY-MM-DD' y se comparan como strings. Nunca se
//      hace aritmética con `Date` sobre la hora del servidor: Vercel corre en
//      UTC y a las 6 p.m. de Costa Rica `new Date()` ya está en el día
//      siguiente. `hoyEnCostaRica()` es la única puerta de entrada al "hoy".
//
//   2. El ciclo del documento termina el 14-ago-2027, pero el calendario no
//      puede apagarse ese día. Cada marca declara su recurrencia y se resuelve
//      para el año que se consulte. Solo las ANCLADO requieren revisión anual y
//      el panel avisa cuándo toca (ver `marcasPorRevisar`).
//
//   3. Lo que el documento afirma sobre estructura calendárica (meses de cinco
//      semanas, fines de semana completos) se CALCULA, no se copia. El
//      documento se equivoca al menos una vez: dice que julio 2027 tiene cinco
//      domingos y tiene cuatro (el 1 de julio cae jueves).

import { DEFAULT_TZ } from "@/lib/timezone";

// ─── Ejes de carga ───────────────────────────────────────────────────────────
// Escala 0–4. Los cuatro primeros miden carga sobre la persona. El quinto mide
// algo distinto: cuánto ruido institucional compite por la atención ese mes.
// Por eso no suma a la fatiga, se resta (ver `ventanaDeOportunidad`).

export const EJES = [
  {
    id: "financiero",
    label: "Financiero",
    descripcion: "Liquidez, deuda, gasto forzado y descalce entre ingresos y costos fijos.",
  },
  {
    id: "academico",
    label: "Académico",
    descripcion: "Exámenes, matrículas, admisión y transiciones del ciclo lectivo.",
  },
  {
    id: "laboral",
    label: "Laboral",
    descripcion: "Burnout, presión por metas y riesgos psicosociales en el trabajo.",
  },
  {
    id: "familiar",
    label: "Familiar y social",
    descripcion: "Convivencia forzada, duelo, cuidados no remunerados y expectativa festiva.",
  },
  {
    id: "institucional",
    label: "Ruido institucional",
    descripcion:
      "Cuánto habla ya el resto del ecosistema sobre salud mental ese mes. Alto = más competencia por la atención, no más sufrimiento.",
  },
];

export const EJES_DE_FATIGA = ["financiero", "academico", "laboral", "familiar"];

export const ESCALA_MAXIMA = 4;

// ─── Ventanas de lag ─────────────────────────────────────────────────────────
// Recomendación §5.1: el colapso no ocurre durante el pico, ocurre cuando la
// exigencia cede. La campaña se pauta antes (prevención) o después
// (integración), no encima del evento.

export const VENTANAS = [
  {
    id: "PREPARACION",
    label: "Preparación",
    desde: -28,
    hasta: -15,
    accion: "Brief, tema y disciplina. Asignar el artículo y el carrusel.",
  },
  {
    id: "PREVENCION",
    label: "Prevención",
    desde: -14,
    hasta: -3,
    accion: "Publicar y pautar la pieza psicoeducativa anticipatoria.",
  },
  {
    id: "PICO",
    label: "Pico",
    desde: -2,
    hasta: 2,
    accion: "Presencia y contención. No pautar oferta comercial agresiva.",
  },
  {
    id: "INTEGRACION",
    label: "Integración",
    desde: 3,
    hasta: 17,
    accion: "Pauta de contención y oferta de consulta: aquí llega la demanda real.",
  },
];

// ─── Utilidades de fecha (todas sobre 'YYYY-MM-DD') ──────────────────────────

const FORMATO_ISO = new Intl.DateTimeFormat("en-CA", {
  timeZone: DEFAULT_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** El "hoy" del negocio, en hora de Costa Rica, como 'YYYY-MM-DD'. */
export function hoyEnCostaRica(ahora = new Date()) {
  return FORMATO_ISO.format(ahora);
}

function esIso(valor) {
  return typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

/** Convierte 'YYYY-MM-DD' a un Date fijado a mediodía UTC (inmune a DST y a offsets). */
function aFecha(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d, 12, 0, 0));
}

function aIso(fecha) {
  return fecha.toISOString().slice(0, 10);
}

export function sumarDias(iso, dias) {
  const f = aFecha(iso);
  f.setUTCDate(f.getUTCDate() + dias);
  return aIso(f);
}

/** Días calendario de `desde` a `hasta`. Positivo si `hasta` es posterior. */
export function diferenciaDias(desde, hasta) {
  return Math.round((aFecha(hasta) - aFecha(desde)) / 86400000);
}

export function anioDe(iso) {
  return Number(iso.slice(0, 4));
}

export function mesDe(iso) {
  return Number(iso.slice(5, 7));
}

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function diaSemanaDe(iso) {
  return DIAS_SEMANA[aFecha(iso).getUTCDay()];
}

// ─── Estructura calendárica calculada ────────────────────────────────────────

/**
 * Cuántas veces cae cada día de la semana en un mes. Devuelve un arreglo de 7
 * posiciones indexado como getUTCDay() (0 = domingo).
 */
export function contarDiasSemana(anio, mes) {
  const cuenta = [0, 0, 0, 0, 0, 0, 0];
  const f = new Date(Date.UTC(anio, mes - 1, 1, 12));
  while (f.getUTCMonth() === mes - 1) {
    cuenta[f.getUTCDay()] += 1;
    f.setUTCDate(f.getUTCDate() + 1);
  }
  return cuenta;
}

/**
 * Hechos estructurales del mes, calculados. Es lo que sustituye a las
 * afirmaciones escritas a mano del documento.
 */
export function estructuraDelMes(anio, mes) {
  const cuenta = contarDiasSemana(anio, mes);
  const conCinco = cuenta
    .map((n, i) => (n === 5 ? DIAS_SEMANA[i] : null))
    .filter(Boolean);
  const finesDeSemanaCompletos = cuenta[5] === 5 && cuenta[6] === 5 && cuenta[0] === 5;

  return {
    anio,
    mes,
    diasConCinco: conCinco,
    finesDeSemanaCompletos,
    nota: finesDeSemanaCompletos
      ? "Cinco fines de semana completos: la cuesta más dura para el presupuesto quincenal."
      : conCinco.length
        ? `Mes de cinco ${conCinco.join(", ")}: los costos fijos se desfasan frente al ingreso semanal.`
        : null,
  };
}

// ─── Reglas de fechas móviles ────────────────────────────────────────────────

/** Domingo de Pascua (Meeus/Jones/Butcher, calendario gregoriano). */
export function domingoDePascua(anio) {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Cuarto jueves de noviembre + 1 día. */
function blackFriday(anio) {
  const primero = new Date(Date.UTC(anio, 10, 1, 12));
  const desplazamiento = (4 - primero.getUTCDay() + 7) % 7; // 4 = jueves
  const cuartoJueves = 1 + desplazamiento + 21;
  return `${anio}-11-${String(cuartoJueves + 1).padStart(2, "0")}`;
}

const REGLAS_MOVILES = {
  "jueves-santo": (anio) => sumarDias(domingoDePascua(anio), -3),
  "viernes-santo": (anio) => sumarDias(domingoDePascua(anio), -2),
  "semana-santa": (anio) => ({
    inicio: sumarDias(domingoDePascua(anio), -6),
    fin: domingoDePascua(anio),
    pico: sumarDias(domingoDePascua(anio), -3),
  }),
  "black-friday": (anio) => blackFriday(anio),
};

// ─── Precisión de la fecha ───────────────────────────────────────────────────
// DIA    → fecha exacta, dispara recordatorios día a día.
// SEMANA → rango confiable, el pico es orientativo.
// MES    → el documento solo dice el mes. No dispara ventanas de lag; genera
//          una tarea de "confirmar fecha" al entrar el mes.

export const PRECISIONES = { DIA: "DIA", SEMANA: "SEMANA", MES: "MES" };

// ─── Catálogo de marcas ──────────────────────────────────────────────────────
//
// `pico` es el día al que se ancla el recordatorio, no necesariamente el día de
// mayor sufrimiento. Para efemérides es la fecha. Para períodos académicos es
// el INICIO del período: el contenido preventivo tiene que aterrizar antes de
// que el estudiante entre en exámenes, y la ventana de INTEGRACIÓN ya cubre el
// durante y el después.
//
// `temas` y `disciplinas` son slugs de la biblioteca. Pueden no existir todavía:
// la curaduría de temas es manual y el backfill no inventa temas. Cuando falta,
// el panel lo reporta como tarea de curaduría en vez de fallar.

export const MARCAS = [
  // ── Agosto ────────────────────────────────────────────────────────────────
  {
    id: "dia-de-la-madre",
    titulo: "Día de la Madre",
    tipo: "FERIADO",
    recurrencia: "ANUAL",
    mesDia: "08-15",
    precision: PRECISIONES.DIA,
    ejes: { familiar: 4, financiero: 3 },
    publico: ["Mujeres cuidadoras", "Familias en duelo"],
    vector:
      "Sobrecarga no remunerada post-festejo (doble jornada), duelo por pérdida de figuras maternas y sobreendeudamiento comercial.",
    foco: "Culpa materna, duelo y carga mental de los cuidados.",
    temas: ["duelo", "carga-mental"],
    disciplinas: ["psicologia-clinica"],
    fuente: "§3.1",
  },
  {
    id: "finales-2q-privadas",
    titulo: "Finales II cuatrimestre (universidades privadas)",
    tipo: "ACADEMICO",
    recurrencia: "ANUAL",
    mesDia: "08-01",
    mesDiaFin: "08-14",
    precision: PRECISIONES.SEMANA,
    ejes: { academico: 4, financiero: 2 },
    publico: ["Universitarios privados"],
    vector: "Alta densidad de carga cognitiva y miedo al fracaso académico.",
    foco: "Ansiedad ante exámenes y gestión del estudio.",
    temas: ["ansiedad", "estres-academico"],
    disciplinas: ["psicologia-clinica"],
    fuente: "§3.13",
  },
  {
    id: "matricula-3q-privadas",
    titulo: "Matrícula III cuatrimestre (universidades privadas)",
    tipo: "ACADEMICO",
    recurrencia: "ANUAL",
    mesDia: "08-15",
    mesDiaFin: "08-31",
    precision: PRECISIONES.SEMANA,
    ejes: { financiero: 3 },
    publico: ["Hogares con universitarios"],
    vector: "Alta demanda de liquidez en hogares justo después del gasto del Día de la Madre.",
    foco: "Estrés financiero familiar.",
    temas: ["estres-financiero"],
    disciplinas: [],
    fuente: "§3.1",
  },
  {
    id: "dia-persona-negra",
    titulo: "Día de la Persona Negra y la Cultura Afrocostarricense",
    tipo: "EFEMERIDE",
    recurrencia: "ANUAL",
    mesDia: "08-31",
    precision: PRECISIONES.DIA,
    ejes: { institucional: 1 },
    publico: ["Población afrocostarricense"],
    vector: "Visibilización cultural y étnica; salud mental y experiencia de discriminación.",
    foco: "Pertenencia, identidad y salud mental comunitaria.",
    temas: [],
    disciplinas: [],
    fuente: "§3.1",
  },

  // ── Septiembre ────────────────────────────────────────────────────────────
  {
    id: "semana-prevencion-suicidio",
    titulo: "Semana de la Prevención del Suicidio",
    tipo: "EFEMERIDE",
    recurrencia: "ANUAL",
    mesDia: "09-05",
    mesDiaFin: "09-11",
    mesDiaPico: "09-10",
    precision: PRECISIONES.DIA,
    ejes: { institucional: 4, familiar: 2 },
    publico: ["Adolescentes", "Cuidadores", "Jóvenes adultos"],
    vector: "Epicentro de la concienciación médica y psicoeducativa del año.",
    foco: "Prevención del suicidio, señales de alarma y qué hacer ante una crisis.",
    temas: ["prevencion-suicidio", "crisis"],
    disciplinas: ["psicologia-clinica", "psiquiatria"],
    fuente: "§3.2",
    prioridad: "ALTA",
  },
  {
    id: "independencia",
    titulo: "Antorcha e Independencia",
    tipo: "FERIADO",
    recurrencia: "ANUAL",
    mesDia: "09-14",
    mesDiaFin: "09-15",
    mesDiaPico: "09-15",
    precision: PRECISIONES.DIA,
    ejes: { familiar: 2, financiero: 2 },
    publico: ["Padres y madres de escolares"],
    vector: "Cansancio acumulado por logística y gasto de desfiles y uniformes.",
    foco: "Agotamiento parental y expectativas de rendimiento escolar.",
    temas: ["parentalidad"],
    disciplinas: [],
    fuente: "§3.2",
  },
  {
    id: "parciales-2sem-publico",
    titulo: "Primeros parciales II semestre (universidades públicas)",
    tipo: "ACADEMICO",
    recurrencia: "ANUAL",
    mesDia: "09-15",
    mesDiaFin: "09-30",
    precision: PRECISIONES.SEMANA,
    ejes: { academico: 3 },
    publico: ["Universitarios públicos"],
    vector: "Primer choque de exigencia del semestre.",
    foco: "Métodos de estudio, sueño y ansiedad de rendimiento.",
    temas: ["ansiedad", "sueno"],
    disciplinas: ["psicologia-clinica"],
    fuente: "§3.2",
  },

  // ── Octubre ───────────────────────────────────────────────────────────────
  {
    id: "dia-mundial-salud-mental",
    titulo: "Día Mundial de la Salud Mental",
    tipo: "EFEMERIDE",
    recurrencia: "ANUAL",
    mesDia: "10-10",
    precision: PRECISIONES.DIA,
    ejes: { institucional: 4 },
    publico: ["Población general", "Empresas", "Medios"],
    vector: "Marco socioinstitucional para el lanzamiento formal de intervenciones profundas.",
    foco: "Pieza ancla del año: qué es la salud mental y cuándo pedir ayuda.",
    temas: ["salud-mental"],
    disciplinas: ["psicologia-clinica", "psiquiatria"],
    fuente: "§3.3",
    prioridad: "ALTA",
  },
  {
    id: "dia-culturas",
    titulo: "Día de las Culturas",
    tipo: "EFEMERIDE",
    recurrencia: "ANUAL",
    mesDia: "10-12",
    precision: PRECISIONES.DIA,
    ejes: { institucional: 1 },
    publico: ["Población general"],
    vector: "Día lectivo, no feriado: no descarga la semana laboral ni escolar.",
    foco: "Identidad e interculturalidad.",
    temas: [],
    disciplinas: [],
    fuente: "§3.3",
  },
  {
    id: "pruebas-admision-paa",
    titulo: "Pruebas de Admisión Universitaria (PAA: UCR, UNA, TEC)",
    tipo: "ACADEMICO",
    recurrencia: "ANCLADO",
    inicio: "2026-10-01",
    fin: "2026-10-31",
    precision: PRECISIONES.MES,
    revisarDesde: "2026-09-01",
    ejes: { academico: 4, familiar: 3 },
    publico: ["Adolescentes", "Padres y madres"],
    vector:
      "Ansiedad de ejecución y miedo al fracaso en adolescentes; expectativas desmedidas y presión económica en padres.",
    foco: "Ansiedad de examen, autoestima y el peso del proyecto familiar sobre el hijo.",
    temas: ["ansiedad", "adolescencia"],
    disciplinas: ["psicologia-clinica"],
    fuente: "§3.3",
    nota: "El documento solo indica el mes. Confirmar fechas exactas con UCR/UNA/TEC cada año.",
  },
  {
    id: "cierre-lectivo-mep-pruebas",
    titulo: "Pruebas de cierre lectivo (MEP)",
    tipo: "ACADEMICO",
    recurrencia: "ANCLADO",
    inicio: "2026-10-01",
    fin: "2026-11-30",
    precision: PRECISIONES.MES,
    revisarDesde: "2026-09-01",
    ejes: { academico: 3, familiar: 2 },
    publico: ["Escolares", "Colegiales", "Familias"],
    vector: "Presión de promoción y conflicto familiar por rendimiento.",
    foco: "Rendimiento escolar sin castigo: cómo acompañar sin presionar.",
    temas: ["parentalidad", "adolescencia"],
    disciplinas: [],
    fuente: "§3.3",
  },
  {
    id: "presion-q3",
    titulo: "Cierre de métricas Q3 (entorno corporativo)",
    tipo: "LABORAL",
    recurrencia: "ANUAL",
    mesDia: "10-01",
    mesDiaFin: "10-31",
    precision: PRECISIONES.MES,
    ejes: { laboral: 3 },
    publico: ["Fuerza laboral", "Mandos medios"],
    vector: "Presión por métricas trimestrales sobre una base ya fatigada.",
    foco: "Salud mental organizacional y límites en el trabajo.",
    temas: ["burnout"],
    disciplinas: [],
    fuente: "§3.3",
  },

  // ── Noviembre ─────────────────────────────────────────────────────────────
  {
    id: "ventana-silenciosa-noviembre",
    titulo: "Ventana silenciosa de noviembre",
    tipo: "ESTRUCTURAL",
    recurrencia: "ANUAL",
    mesDia: "11-01",
    mesDiaFin: "11-30",
    precision: PRECISIONES.MES,
    ejes: { laboral: 4 },
    publico: ["Trabajadores", "Adultos en general"],
    vector:
      "Bloque ininterrumpido de 30 días sin feriados nacionales. Burnout corporativo severo sin descarga institucional.",
    foco: "Burnout, fatiga acumulada y descanso que no llega.",
    temas: ["burnout", "estres"],
    disciplinas: ["psicologia-clinica"],
    fuente: "§3.4 y §5.2",
    prioridad: "ALTA",
    oportunidad: true,
  },
  {
    id: "black-friday",
    titulo: "Black Friday",
    tipo: "COMERCIAL",
    recurrencia: "MOVIL",
    regla: "black-friday",
    precision: PRECISIONES.DIA,
    ejes: { financiero: 2 },
    publico: ["Adultos con fatiga acumulada"],
    vector:
      "El bombardeo comercial activa la compulsión como mecanismo desadaptativo de afrontamiento ante la fatiga.",
    foco: "Compra impulsiva como regulación emocional.",
    temas: ["impulsividad", "estres-financiero"],
    disciplinas: [],
    fuente: "§3.4",
  },
  {
    id: "cierre-2sem-publico",
    titulo: "Cierre II semestre (universidades públicas)",
    tipo: "ACADEMICO",
    recurrencia: "ANUAL",
    mesDia: "11-16",
    mesDiaFin: "11-30",
    precision: PRECISIONES.SEMANA,
    ejes: { academico: 4 },
    publico: ["Universitarios públicos"],
    vector:
      "Pico histórico de consultas por crisis de ansiedad, somatización y fatiga académica.",
    foco: "Crisis de ansiedad, somatización y pérdida de cursos.",
    temas: ["ansiedad", "estres-academico"],
    disciplinas: ["psicologia-clinica"],
    fuente: "§3.4",
    prioridad: "ALTA",
  },

  // ── Diciembre ─────────────────────────────────────────────────────────────
  {
    id: "abolicion-ejercito",
    titulo: "Día de la Abolición del Ejército",
    tipo: "FERIADO",
    recurrencia: "ANUAL",
    mesDia: "12-01",
    precision: PRECISIONES.DIA,
    ejes: { institucional: 1 },
    publico: ["Población general"],
    vector: "Feriado no obligatorio: descarga parcial.",
    foco: "—",
    temas: [],
    disciplinas: [],
    fuente: "§3.5",
  },
  {
    id: "aguinaldo",
    titulo: "Depósito del aguinaldo",
    tipo: "ESTRUCTURAL",
    recurrencia: "ANUAL",
    mesDia: "12-01",
    mesDiaFin: "12-15",
    precision: PRECISIONES.SEMANA,
    ejes: { financiero: 3 },
    publico: ["Personas asalariadas"],
    vector:
      "Liquidez ambivalente: alivio momentáneo seguido de gasto acelerado que se paga en enero.",
    foco: "Decidir con dinero disponible sin hipotecar enero.",
    temas: ["estres-financiero"],
    disciplinas: [],
    fuente: "§3.5",
  },
  {
    id: "finales-3q-privadas",
    titulo: "Finales III cuatrimestre (universidades privadas)",
    tipo: "ACADEMICO",
    recurrencia: "ANUAL",
    mesDia: "12-01",
    mesDiaFin: "12-12",
    precision: PRECISIONES.SEMANA,
    ejes: { academico: 3 },
    publico: ["Universitarios privados"],
    vector: "Exámenes finales encima de la saturación de diciembre.",
    foco: "Cierre de ciclo académico y balance de año.",
    temas: ["estres-academico"],
    disciplinas: [],
    fuente: "§3.5",
  },
  {
    id: "cierre-curso-mep",
    titulo: "Cierre oficial del curso lectivo (MEP)",
    tipo: "ACADEMICO",
    recurrencia: "ANCLADO",
    inicio: "2026-12-11",
    precision: PRECISIONES.DIA,
    estimado: true,
    revisarDesde: "2026-10-01",
    ejes: { academico: 2, familiar: 2 },
    publico: ["Familias", "Escolares"],
    vector: "Fin de la estructura diaria: se destapa el conflicto que la rutina contenía.",
    foco: "Vacaciones sin rutina y convivencia familiar prolongada.",
    temas: ["parentalidad"],
    disciplinas: [],
    fuente: "§3.5",
    nota: "Fecha estimada en el documento. Confirmar con el calendario escolar MEP.",
  },
  {
    id: "fiestas-fin-de-ano",
    titulo: "Nochebuena y Fin de Año",
    tipo: "SOCIAL",
    recurrencia: "ANUAL",
    mesDia: "12-24",
    mesDiaFin: "12-31",
    mesDiaPico: "12-24",
    precision: PRECISIONES.DIA,
    ejes: { familiar: 4 },
    publico: ["Personas en duelo", "Familias en conflicto", "Población general"],
    vector:
      "Disonancia entre la felicidad obligatoria comercial y los duelos no resueltos, conflictos familiares o balances deficitarios. Disparo de sintomatología depresiva.",
    foco: "Holiday blues, duelo en fechas y balance de año sin autocastigo.",
    temas: ["duelo", "depresion"],
    disciplinas: ["psicologia-clinica", "psiquiatria"],
    fuente: "§3.5",
    prioridad: "ALTA",
  },

  // ── Enero ─────────────────────────────────────────────────────────────────
  {
    id: "ano-nuevo",
    titulo: "Año Nuevo",
    tipo: "FERIADO",
    recurrencia: "ANUAL",
    mesDia: "01-01",
    precision: PRECISIONES.DIA,
    ejes: { familiar: 3, financiero: 3 },
    publico: ["Población general"],
    vector:
      "Vacío existencial posfestivo y golpe de realidad financiero al primer día hábil.",
    foco: "Propósitos sin autoexigencia y vacío de después de las fiestas.",
    temas: ["depresion", "estres-financiero"],
    disciplinas: [],
    fuente: "§3.6",
  },
  {
    id: "cuesta-de-enero",
    titulo: "Cuesta de enero",
    tipo: "ESTRUCTURAL",
    recurrencia: "ANUAL",
    mesDia: "01-02",
    mesDiaFin: "01-31",
    precision: PRECISIONES.MES,
    ejes: { financiero: 4 },
    publico: ["Hogares endeudados"],
    vector:
      "Culpa por el sobreendeudamiento de diciembre y angustia por falta de liquidez sostenida todo el mes.",
    foco: "Vergüenza y deuda: hablar de dinero sin moralizar.",
    temas: ["estres-financiero", "ansiedad"],
    disciplinas: [],
    fuente: "§3.6",
    prioridad: "ALTA",
  },
  {
    id: "inicio-1q-privadas",
    titulo: "Inicio I cuatrimestre y matrícula (universidades privadas)",
    tipo: "ACADEMICO",
    recurrencia: "ANUAL",
    mesDia: "01-11",
    mesDiaFin: "01-18",
    precision: PRECISIONES.SEMANA,
    ejes: { financiero: 3, academico: 2 },
    publico: ["Hogares con universitarios"],
    vector: "Matrícula sobre el mes de menor liquidez del año.",
    foco: "Decisión académica bajo presión económica.",
    temas: ["estres-financiero"],
    disciplinas: [],
    fuente: "§3.6",
  },

  // ── Febrero ───────────────────────────────────────────────────────────────
  {
    id: "inicio-curso-mep",
    titulo: "Inicio del curso lectivo (MEP)",
    tipo: "ACADEMICO",
    recurrencia: "ANCLADO",
    inicio: "2027-02-08",
    precision: PRECISIONES.DIA,
    estimado: true,
    revisarDesde: "2026-12-01",
    ejes: { academico: 4, financiero: 4, familiar: 3 },
    publico: ["Familias", "Niños y adolescentes"],
    vector:
      "Estrés financiero severo por útiles y uniformes. Ansiedad de adaptación y reactivación de dinámicas de acoso escolar.",
    foco: "Vuelta a clases: adaptación, acoso escolar y ansiedad de separación.",
    temas: ["acoso-escolar", "parentalidad", "ansiedad"],
    disciplinas: ["psicologia-clinica"],
    fuente: "§3.7",
    prioridad: "ALTA",
    nota: "Fecha estimada en el documento. Confirmar con el calendario escolar MEP.",
  },
  {
    id: "san-valentin",
    titulo: "San Valentín",
    tipo: "COMERCIAL",
    recurrencia: "ANUAL",
    mesDia: "02-14",
    precision: PRECISIONES.DIA,
    ejes: { familiar: 2 },
    publico: ["Personas solas", "Parejas en conflicto", "Duelo de pareja"],
    vector: "Comparación social amplificada y expectativa romántica normativa.",
    foco: "Vínculos, soledad y ruptura.",
    temas: ["vinculos", "soledad"],
    disciplinas: [],
    fuente: "§3.7",
  },
  {
    id: "inicio-1sem-publico",
    titulo: "Inicio I semestre (universidades públicas)",
    tipo: "ACADEMICO",
    recurrencia: "ANUAL",
    mesDia: "02-22",
    mesDiaFin: "02-26",
    precision: PRECISIONES.SEMANA,
    ejes: { academico: 3, financiero: 2 },
    publico: ["Universitarios públicos", "Estudiantes de primer ingreso"],
    vector: "Transición y desarraigo en primer ingreso.",
    foco: "Primer año universitario: adaptación y salud mental.",
    temas: ["adolescencia", "ansiedad"],
    disciplinas: [],
    fuente: "§3.7",
  },

  // ── Marzo ─────────────────────────────────────────────────────────────────
  {
    id: "semana-santa",
    titulo: "Semana Santa (Jueves y Viernes Santos)",
    tipo: "FERIADO",
    recurrencia: "MOVIL",
    regla: "semana-santa",
    precision: PRECISIONES.DIA,
    ejes: { familiar: 3 },
    publico: ["Familias"],
    vector:
      "Ruptura de la rutina apenas instalada y tensión por convivencia familiar forzada durante el receso.",
    foco: "Convivencia forzada y límites familiares.",
    temas: ["vinculos", "parentalidad"],
    disciplinas: [],
    fuente: "§3.8",
  },
  {
    id: "parciales-1q-privadas",
    titulo: "Parciales I cuatrimestre (universidades privadas)",
    tipo: "ACADEMICO",
    recurrencia: "ANUAL",
    mesDia: "03-08",
    mesDiaFin: "03-20",
    precision: PRECISIONES.SEMANA,
    ejes: { academico: 3 },
    publico: ["Universitarios privados"],
    vector: "Exigencia a mitad de cuatrimestre.",
    foco: "Ansiedad de rendimiento.",
    temas: ["estres-academico"],
    disciplinas: [],
    fuente: "§3.8",
  },

  // ── Abril ─────────────────────────────────────────────────────────────────
  {
    id: "juan-santamaria",
    titulo: "Día de Juan Santamaría",
    tipo: "FERIADO",
    recurrencia: "ANUAL",
    mesDia: "04-11",
    precision: PRECISIONES.DIA,
    ejes: {},
    publico: ["Población general"],
    vector: "Feriado de pago obligatorio.",
    foco: "—",
    temas: [],
    disciplinas: [],
    fuente: "§3.9",
  },
  {
    id: "finales-1q-privadas",
    titulo: "Finales I cuatrimestre (universidades privadas)",
    tipo: "ACADEMICO",
    recurrencia: "ANUAL",
    mesDia: "04-19",
    mesDiaFin: "04-25",
    precision: PRECISIONES.SEMANA,
    ejes: { academico: 4 },
    publico: ["Universitarios privados"],
    vector: "Alta densidad de carga cognitiva y estrés académico.",
    foco: "Exámenes finales y agotamiento cognitivo.",
    temas: ["estres-academico", "ansiedad"],
    disciplinas: [],
    fuente: "§3.9",
  },
  {
    id: "parciales-1sem-publico",
    titulo: "Parciales de medio semestre (universidades públicas)",
    tipo: "ACADEMICO",
    recurrencia: "ANUAL",
    mesDia: "04-05",
    mesDiaFin: "04-30",
    precision: PRECISIONES.MES,
    ejes: { academico: 3 },
    publico: ["Universitarios públicos"],
    vector: "Exigencia sostenida a mitad de semestre.",
    foco: "Sostener el semestre sin quebrarse.",
    temas: ["estres-academico"],
    disciplinas: [],
    fuente: "§3.9",
  },

  // ── Mayo ──────────────────────────────────────────────────────────────────
  {
    id: "dia-del-trabajo",
    titulo: "Día Internacional del Trabajo",
    tipo: "FERIADO",
    recurrencia: "ANUAL",
    mesDia: "05-01",
    precision: PRECISIONES.DIA,
    ejes: { laboral: 4 },
    publico: ["Fuerza laboral", "Empresas"],
    vector:
      "Momento crítico para pautar sobre prevención de riesgos psicosociales en las empresas.",
    foco: "Burnout, acoso laboral y riesgos psicosociales.",
    temas: ["burnout", "acoso-laboral"],
    disciplinas: ["psicologia-organizacional"],
    fuente: "§3.10",
    prioridad: "ALTA",
  },
  {
    id: "ventana-silenciosa-mayo",
    titulo: "Ventana silenciosa de mayo",
    tipo: "ESTRUCTURAL",
    recurrencia: "ANUAL",
    mesDia: "05-02",
    mesDiaFin: "05-31",
    precision: PRECISIONES.MES,
    ejes: { laboral: 4, familiar: 2 },
    publico: ["Fuerza laboral", "Personas cuidadoras"],
    vector:
      "Sin feriados ni intervenciones institucionales masivas después del 1 de mayo: audiencia fatigada y barata de alcanzar.",
    foco: "Salud ocupacional y carga mental de los cuidados.",
    temas: ["burnout", "carga-mental"],
    disciplinas: ["psicologia-organizacional"],
    fuente: "§3.10 y §5.2",
    prioridad: "ALTA",
    oportunidad: true,
  },
  {
    id: "inicio-2q-privadas",
    titulo: "Inicio II cuatrimestre y colegiaturas (universidades privadas)",
    tipo: "ACADEMICO",
    recurrencia: "ANUAL",
    mesDia: "05-10",
    mesDiaFin: "05-17",
    precision: PRECISIONES.SEMANA,
    ejes: { financiero: 3 },
    publico: ["Hogares con universitarios"],
    vector: "Matrícula y colegiaturas.",
    foco: "Presupuesto familiar y estudio.",
    temas: ["estres-financiero"],
    disciplinas: [],
    fuente: "§3.10",
  },

  // ── Junio ─────────────────────────────────────────────────────────────────
  {
    id: "dia-del-padre",
    titulo: "Día del Padre",
    tipo: "SOCIAL",
    recurrencia: "ANUAL",
    mesDia: "06-20",
    precision: PRECISIONES.DIA,
    ejes: { familiar: 3 },
    publico: ["Hombres adultos", "Padres", "Familias en duelo"],
    vector:
      "Oportunidad clave para abordar la salud mental en hombres, tradicionalmente subdiagnosticada.",
    foco: "Salud mental masculina: pedir ayuda no es debilidad.",
    temas: ["salud-mental-masculina", "depresion"],
    disciplinas: ["psicologia-clinica"],
    fuente: "§3.11",
    prioridad: "ALTA",
  },
  {
    id: "cierre-1sem-publico",
    titulo: "Finales y cierre I semestre (universidades públicas)",
    tipo: "ACADEMICO",
    recurrencia: "ANUAL",
    mesDia: "06-21",
    mesDiaFin: "06-30",
    precision: PRECISIONES.SEMANA,
    ejes: { academico: 4 },
    publico: ["Universitarios públicos"],
    vector: "Gestión de la frustración académica ante pérdidas de cursos.",
    foco: "Perder un curso no es perder el proyecto.",
    temas: ["estres-academico", "autoestima"],
    disciplinas: [],
    fuente: "§3.11",
  },

  // ── Julio ─────────────────────────────────────────────────────────────────
  {
    id: "vacaciones-medio-ano-mep",
    titulo: "Vacaciones de medio año (MEP)",
    tipo: "ESTRUCTURAL",
    recurrencia: "ANCLADO",
    inicio: "2027-07-05",
    fin: "2027-07-16",
    precision: PRECISIONES.SEMANA,
    estimado: true,
    revisarDesde: "2027-05-01",
    ejes: { familiar: 4, laboral: 3, financiero: 2 },
    publico: ["Padres y madres sin red de cuido"],
    vector:
      "Crisis de conciliación trabajo-familia y gasto no presupuestado en entretenimiento o campamentos.",
    foco: "Conciliación del cuido y culpa parental.",
    temas: ["parentalidad", "carga-mental"],
    disciplinas: [],
    fuente: "§3.12",
    nota: "Fechas estimadas en el documento. Confirmar con el calendario escolar MEP.",
  },
  {
    id: "anexion-nicoya",
    titulo: "Anexión del Partido de Nicoya",
    tipo: "FERIADO",
    recurrencia: "ANUAL",
    mesDia: "07-25",
    precision: PRECISIONES.DIA,
    ejes: {},
    publico: ["Población general"],
    vector: "Feriado de pago obligatorio.",
    foco: "—",
    temas: [],
    disciplinas: [],
    fuente: "§3.12",
  },

  // ── Agosto (cierre de ciclo) ──────────────────────────────────────────────
  {
    id: "virgen-de-los-angeles",
    titulo: "Día de la Virgen de los Ángeles (Romería)",
    tipo: "FERIADO",
    recurrencia: "ANUAL",
    mesDia: "08-02",
    precision: PRECISIONES.DIA,
    ejes: { familiar: 2 },
    publico: ["Población general"],
    vector: "Alta movilización social; feriado no obligatorio.",
    foco: "Sentido, fe y comunidad como factores protectores.",
    temas: [],
    disciplinas: [],
    fuente: "§3.13",
  },
];

// ─── Carga base por mes ──────────────────────────────────────────────────────
// Matriz curada (§4 del documento, escala 0–4), indexada por número de mes.
// Es anual y evergreen a propósito: la estructura psicosocial del año se repite.
// Lo que sí varía año con año (meses de cinco fines de semana) se calcula y se
// aplica como ajuste explícito en `cargaDelMes`.

export const CARGA_BASE_MENSUAL = {
  1: { financiero: 4, academico: 2, laboral: 2, familiar: 3, institucional: 1 },
  2: { financiero: 4, academico: 4, laboral: 2, familiar: 3, institucional: 1 },
  3: { financiero: 2, academico: 3, laboral: 2, familiar: 3, institucional: 1 },
  4: { financiero: 2, academico: 4, laboral: 2, familiar: 1, institucional: 1 },
  5: { financiero: 3, academico: 2, laboral: 4, familiar: 2, institucional: 0 },
  6: { financiero: 2, academico: 4, laboral: 2, familiar: 3, institucional: 1 },
  7: { financiero: 3, academico: 1, laboral: 3, familiar: 4, institucional: 0 },
  8: { financiero: 3, academico: 4, laboral: 2, familiar: 4, institucional: 1 },
  9: { financiero: 4, academico: 3, laboral: 2, familiar: 2, institucional: 4 },
  10: { financiero: 2, academico: 4, laboral: 3, familiar: 3, institucional: 4 },
  11: { financiero: 2, academico: 4, laboral: 4, familiar: 2, institucional: 0 },
  12: { financiero: 3, academico: 3, laboral: 2, familiar: 4, institucional: 1 },
};

export const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];

function acotar(valor) {
  return Math.max(0, Math.min(ESCALA_MAXIMA, valor));
}

/**
 * Carga de un mes concreto: base curada más los ajustes estructurales que se
 * calculan del calendario real de ese año. Los ajustes se devuelven aparte para
 * que la interfaz pueda explicar por qué un número no es el de la tabla base.
 */
export function cargaDelMes(anio, mes) {
  const base = CARGA_BASE_MENSUAL[mes];
  const estructura = estructuraDelMes(anio, mes);
  const ajustes = [];

  const ejes = { ...base };
  if (estructura.finesDeSemanaCompletos) {
    const antes = ejes.financiero;
    ejes.financiero = acotar(ejes.financiero + 1);
    ajustes.push({
      eje: "financiero",
      delta: ejes.financiero - antes,
      motivo: "Cinco fines de semana completos en el mes.",
    });
  }

  return { anio, mes, ejes, estructura, ajustes };
}

/**
 * Fatiga = promedio de los cuatro ejes de carga.
 * Oportunidad = fatiga menos ruido institucional. Reproduce la conclusión §5.2
 * del documento: los mejores meses de adquisición son los que combinan mucha
 * fatiga con poca competencia por la atención.
 */
export function ventanaDeOportunidad(ejes) {
  const fatiga =
    EJES_DE_FATIGA.reduce((suma, id) => suma + (ejes[id] || 0), 0) / EJES_DE_FATIGA.length;
  return {
    fatiga: Number(fatiga.toFixed(2)),
    ruido: ejes.institucional || 0,
    oportunidad: Number((fatiga - (ejes.institucional || 0)).toFixed(2)),
  };
}

/** La matriz completa para el mapa térmico, a partir de un mes de inicio. */
export function matrizAnual(anioInicio, mesInicio = 1, meses = 12) {
  const columnas = [];
  for (let i = 0; i < meses; i += 1) {
    const total = mesInicio - 1 + i;
    const anio = anioInicio + Math.floor(total / 12);
    const mes = (total % 12) + 1;
    const carga = cargaDelMes(anio, mes);
    columnas.push({ ...carga, ...ventanaDeOportunidad(carga.ejes), etiqueta: NOMBRES_MES[mes - 1] });
  }
  return columnas;
}

// ─── Resolución de marcas a fechas concretas ─────────────────────────────────

/**
 * Resuelve una marca al año indicado. Devuelve null si la marca está anclada a
 * un año distinto (las ANCLADO no se proyectan solas: hay que revisarlas).
 */
export function resolverMarca(marca, anio) {
  if (marca.recurrencia === "ANUAL") {
    const inicio = `${anio}-${marca.mesDia}`;
    const fin = marca.mesDiaFin ? `${anio}-${marca.mesDiaFin}` : inicio;
    const pico = marca.mesDiaPico ? `${anio}-${marca.mesDiaPico}` : inicio;
    return { ...marca, inicio, fin, pico };
  }

  if (marca.recurrencia === "MOVIL") {
    const resultado = REGLAS_MOVILES[marca.regla]?.(anio);
    if (!resultado) return null;
    if (typeof resultado === "string") {
      return { ...marca, inicio: resultado, fin: resultado, pico: resultado };
    }
    return { ...marca, ...resultado };
  }

  // ANCLADO: solo existe en el año que declara.
  if (anioDe(marca.inicio) !== anio) return null;
  const fin = marca.fin || marca.inicio;
  return { ...marca, fin, pico: marca.pico || marca.inicio };
}

/**
 * Todas las marcas resueltas que caen dentro de [desde, hasta], considerando el
 * año anterior, el actual y el siguiente (para que una marca de enero aparezca
 * en el horizonte de un diciembre).
 */
export function marcasEnRango(desde, hasta) {
  const anios = new Set([anioDe(desde) - 1, anioDe(desde), anioDe(hasta), anioDe(hasta) + 1]);
  const resueltas = [];
  for (const anio of anios) {
    for (const marca of MARCAS) {
      const r = resolverMarca(marca, anio);
      if (!r) continue;
      if (r.fin < desde || r.inicio > hasta) continue;
      resueltas.push(r);
    }
  }
  return resueltas.sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0));
}

// ─── Ventanas activas: el corazón del recordatorio ───────────────────────────

/**
 * Qué ventana de lag corresponde a una marca en una fecha dada, o null si la
 * marca no está activa ese día.
 *
 * Las marcas con precisión MES no disparan ventanas de lag: el documento no da
 * fecha exacta, así que fingir precisión de día sería inventar. Se reportan
 * aparte, como contexto del mes (ver `contextoDelMes`).
 */
export function ventanaDeMarca(marcaResuelta, fecha) {
  if (marcaResuelta.precision === PRECISIONES.MES) return null;
  const offset = diferenciaDias(fecha, marcaResuelta.pico); // días que faltan
  const ventana = VENTANAS.find((v) => -offset >= v.desde && -offset <= v.hasta);
  if (!ventana) return null;
  return { ...ventana, diasAlPico: offset };
}

/**
 * Todo lo que está vivo hoy, con su ventana. Ordenado por urgencia: primero lo
 * que hay que publicar, luego lo que hay que preparar, luego el seguimiento.
 */
const ORDEN_VENTANA = { PREVENCION: 0, PICO: 1, PREPARACION: 2, INTEGRACION: 3 };

export function ventanasActivas(fecha = hoyEnCostaRica()) {
  const candidatas = marcasEnRango(sumarDias(fecha, -40), sumarDias(fecha, 40));
  const activas = [];
  for (const marca of candidatas) {
    const ventana = ventanaDeMarca(marca, fecha);
    if (!ventana) continue;
    activas.push({ marca, ventana });
  }
  return activas.sort((a, b) => {
    const porVentana = ORDEN_VENTANA[a.ventana.id] - ORDEN_VENTANA[b.ventana.id];
    if (porVentana !== 0) return porVentana;
    if (a.marca.prioridad === "ALTA" && b.marca.prioridad !== "ALTA") return -1;
    if (b.marca.prioridad === "ALTA" && a.marca.prioridad !== "ALTA") return 1;
    return Math.abs(a.ventana.diasAlPico) - Math.abs(b.ventana.diasAlPico);
  });
}

/** Marcas de precisión MES vigentes: contexto, no recordatorio con cuenta regresiva. */
export function contextoDelMes(fecha = hoyEnCostaRica()) {
  return marcasEnRango(fecha, fecha).filter((m) => m.precision === PRECISIONES.MES);
}

/** Próximas marcas con fecha, para la tira de "lo que viene". */
export function proximasMarcas(fecha = hoyEnCostaRica(), dias = 60, limite = 6) {
  return marcasEnRango(sumarDias(fecha, 1), sumarDias(fecha, dias))
    .filter((m) => m.precision !== PRECISIONES.MES)
    .map((m) => ({ marca: m, faltan: diferenciaDias(fecha, m.pico) }))
    .sort((a, b) => a.faltan - b.faltan)
    .slice(0, limite);
}

/**
 * Marcas ANCLADO o estimadas cuya fecha hay que confirmar. El calendario avisa
 * en vez de envejecer en silencio.
 */
export function marcasPorRevisar(fecha = hoyEnCostaRica()) {
  const pendientes = [];
  for (const marca of MARCAS) {
    if (marca.recurrencia !== "ANCLADO" && !marca.estimado) continue;
    const referencia = marca.inicio || `${anioDe(fecha)}-${marca.mesDia}`;
    const vencida = referencia < fecha;
    const enRevision = marca.revisarDesde ? fecha >= marca.revisarDesde : false;
    if (vencida || enRevision) {
      pendientes.push({
        marca,
        vencida,
        motivo: vencida
          ? "La fecha declarada ya pasó: hay que fijar la del ciclo siguiente."
          : "Entró la ventana de confirmación de fecha.",
      });
    }
  }
  return pendientes;
}

// ─── El "dónde estamos hoy" ──────────────────────────────────────────────────

/**
 * Retrato del momento: carga del mes, oportunidad, estructura calendárica
 * calculada, ventanas activas y contexto. Es lo que consume el bloque del
 * inventario diario.
 */
export function momentoActual(fecha = hoyEnCostaRica()) {
  const anio = anioDe(fecha);
  const mes = mesDe(fecha);
  const carga = cargaDelMes(anio, mes);
  const oportunidad = ventanaDeOportunidad(carga.ejes);

  const activas = ventanasActivas(fecha);

  // Los ejes empatan a menudo y el empate es información, no ruido: noviembre
  // carga académico y laboral por igual (cierre de semestre público y burnout
  // sin feriados). Desempatar por el orden del arreglo escondería la mitad del
  // mes, así que se devuelven todos los que están en el máximo.
  const maximo = Math.max(...EJES_DE_FATIGA.map((id) => carga.ejes[id] || 0));
  const ejesDominantes = EJES_DE_FATIGA.filter((id) => (carga.ejes[id] || 0) === maximo);

  return {
    fecha,
    anio,
    mes,
    etiquetaMes: NOMBRES_MES[mes - 1],
    diaSemana: diaSemanaDe(fecha),
    ejes: carga.ejes,
    ajustes: carga.ajustes,
    estructura: carga.estructura,
    ...oportunidad,
    ejesDominantes,
    esVentanaSilenciosa: oportunidad.oportunidad >= 2.5,
    ventanasActivas: activas,
    contexto: contextoDelMes(fecha),
    proximas: proximasMarcas(fecha),
    porRevisar: marcasPorRevisar(fecha),
  };
}

// ─── Tareas para el inventario diario ────────────────────────────────────────

function etiquetaDeTarea(marca, ventana) {
  const faltan = ventana.diasAlPico;
  switch (ventana.id) {
    case "PREPARACION":
      return `Preparar «${marca.titulo}» — faltan ${faltan} días`;
    case "PREVENCION":
      return `Publicar y pautar «${marca.titulo}» — faltan ${faltan} días`;
    case "PICO":
      return faltan === 0
        ? `Hoy: ${marca.titulo}`
        : `${marca.titulo} — ${faltan > 0 ? `en ${faltan} días` : `hace ${-faltan} días`}`;
    default:
      return `Seguimiento de «${marca.titulo}» — día ${-faltan} de 17`;
  }
}

/**
 * Convierte el momento en tareas con la misma forma que consume
 * DailyAdminTasks, para que el inventario diario las marque, las cuente y las
 * reinicie sin lógica aparte.
 *
 * El id lleva prefijo `cal:` y no colisiona con las tareas fijas del inventario.
 */
export function tareasDelCalendario(momento, limite = 6) {
  const tareas = momento.ventanasActivas.slice(0, limite).map(({ marca, ventana }) => ({
    id: `cal:${marca.id}:${ventana.id}`,
    label: etiquetaDeTarea(marca, ventana),
    detail: `${ventana.accion} ${marca.vector}`,
    ventana: ventana.id,
    marcaId: marca.id,
  }));

  for (const pendiente of momento.porRevisar) {
    if (tareas.length >= limite + 2) break;
    tareas.push({
      id: `cal:revisar:${pendiente.marca.id}`,
      kind: "decision",
      label: `Confirmar fecha: ${pendiente.marca.titulo}`,
      detail: `${pendiente.motivo} ${pendiente.marca.nota || ""}`.trim(),
      ventana: "REVISION",
      marcaId: pendiente.marca.id,
    });
  }

  return tareas;
}

// ─── Slugs de taxonomía que el calendario espera de la biblioteca ────────────

/** Todos los slugs de tema que declaran las marcas, sin repetir. */
export function temasDelCalendario() {
  return [...new Set(MARCAS.flatMap((m) => m.temas || []))].sort();
}

/** Todos los slugs de disciplina que declaran las marcas, sin repetir. */
export function disciplinasDelCalendario() {
  return [...new Set(MARCAS.flatMap((m) => m.disciplinas || []))].sort();
}

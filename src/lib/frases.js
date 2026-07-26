// src/lib/frases.js
//
// Lectura del corpus de frases diarias. Módulo de SERVIDOR: importa ~300 KB de
// dataset y no debe importarse desde un componente cliente. Los componentes
// reciben datos ya resueltos como props.
//
// El corpus es material editorial cerrado (5.840 asignaciones para la ventana
// 15-ago-2026 → 14-ago-2027) y vive versionado en src/data/frases/. Lo que sí
// cambia a diario —la elección del admin y la verificación de fuentes— vive en
// base de datos (ver frases-queries.js).
//
// Dos reglas de operación gobiernan todo este módulo:
//
//   1. La frase vigente cambia a las 6:00 de Costa Rica, no a medianoche. Antes
//      de esa hora sigue publicada la del día anterior.
//   2. La revisión se trabaja con un día de anticipación, y el viernes cubre
//      sábado, domingo y lunes. Nadie abre el panel un domingo a las 5 a.m.

import { DEFAULT_TZ } from "@/lib/timezone";
import corpus from "@/data/frases/corpus.json";
import calendario from "@/data/frases/dias.json";

export const VERSION_CORPUS = corpus.version;

export const HORA_DE_CAMBIO = 6; // 6:00 en Costa Rica

// ─── Audiencias ──────────────────────────────────────────────────────────────
// El catálogo vive en frases-audiencia.js, que no importa ningún JSON. Se
// reexporta acá por comodidad de los consumidores de servidor, pero un
// componente CLIENTE debe importarlo de allá: importarlo de este módulo se
// lleva los 300 KB del corpus al navegador.

export { AUDIENCIAS, ROLES } from "@/lib/frases-audiencia";
import { AUDIENCIAS } from "@/lib/frases-audiencia";

const ROLES_INTERNOS = { 1: "ancla", 2: "contrapunto" };

const AUDIENCIA_POR_ID = new Map(AUDIENCIAS.map((a) => [a.id, a]));
const DIA_POR_FECHA = new Map(calendario.dias.map((d) => [d.d, d]));

export const PRIMER_DIA = calendario.dias[0].d;
export const ULTIMO_DIA = calendario.dias[calendario.dias.length - 1].d;

// ─── Reloj de Costa Rica ─────────────────────────────────────────────────────

const FORMATO = new Intl.DateTimeFormat("en-CA", {
  timeZone: DEFAULT_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
});

function partesCR(ahora = new Date()) {
  const partes = Object.fromEntries(
    FORMATO.formatToParts(ahora).map((p) => [p.type, p.value]),
  );
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    hora: Number(partes.hour === "24" ? "0" : partes.hour),
  };
}

function aFecha(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d, 12));
}

function sumar(iso, dias) {
  const f = aFecha(iso);
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado. */
function diaSemana(iso) {
  return aFecha(iso).getUTCDay();
}

/**
 * La fecha cuya frase está publicada ahora mismo. Antes de las 6:00 de Costa
 * Rica sigue viva la del día anterior: a las 5 a.m. del martes el público
 * todavía está leyendo la frase del lunes.
 */
export function fechaVigente(ahora = new Date()) {
  const { fecha, hora } = partesCR(ahora);
  return hora < HORA_DE_CAMBIO ? sumar(fecha, -1) : fecha;
}

/** La fecha de calendario en Costa Rica, sin la regla de las 6:00. */
export function fechaHoy(ahora = new Date()) {
  return partesCR(ahora).fecha;
}

/**
 * Qué día hay que trabajar en la sesión de una fecha dada.
 *   viernes         → sábado, domingo y lunes
 *   lunes a jueves  → el día siguiente
 *   sábado y domingo → nada: el viernes ya los cubrió
 */
export function diasAPreparar(fecha) {
  const dow = diaSemana(fecha);
  if (dow === 5) return [sumar(fecha, 1), sumar(fecha, 2), sumar(fecha, 3)];
  if (dow === 6 || dow === 0) return [];
  return [sumar(fecha, 1)];
}

/**
 * La sesión en que le toca decidirse a una fecha. Es la inversa de
 * `diasAPreparar`: sábado, domingo y lunes se deciden el viernes anterior.
 */
export function sesionDe(fecha) {
  const dow = diaSemana(fecha);
  if (dow === 6) return sumar(fecha, -1); // sábado → viernes
  if (dow === 0) return sumar(fecha, -2); // domingo → viernes
  if (dow === 1) return sumar(fecha, -3); // lunes → viernes
  return sumar(fecha, -1);
}

// ─── Resolución de frases ────────────────────────────────────────────────────

export function fuenteDeIndice(indice) {
  return corpus.fuentes[indice] || null;
}

/** Clave estable de una fuente, para cruzarla con su estado de verificación. */
export function claveFuente(fuente) {
  return `${fuente.a} ${fuente.o}`;
}

export function fraseDeIndice(indice) {
  const frase = corpus.frases[indice];
  if (!frase) return null;
  const fuente = corpus.fuentes[frase.f];
  return {
    indice,
    texto: frase.t,
    autor: fuente.a,
    obra: fuente.o,
    claveFuente: claveFuente(fuente),
    categoria: frase.c,
    temas: frase.m,
    largo: frase.t.length,
  };
}

export function totalFrases() {
  return corpus.frases.length;
}

// Índice inverso texto → posición. Se construye una vez por proceso.
const INDICE_POR_TEXTO = new Map(corpus.frases.map((f, i) => [f.t, i]));

/** Posición actual de una frase por su texto, o -1 si ya no está en el corpus. */
export function indiceDeTexto(texto) {
  const i = INDICE_POR_TEXTO.get(String(texto || ""));
  return i === undefined ? -1 : i;
}

/**
 * Reconcilia una elección guardada con el corpus vigente.
 *
 * Los índices se mueven cuando se regenera el dataset: el corpus se ordena
 * alfabéticamente, así que agregar autores desplaza posiciones. La elección
 * guarda una copia del texto justamente para esto, y acá se usa para recuperar
 * el índice correcto. Sin esto, el panel muestra "sin elegir" una elección que
 * sí está guardada.
 *
 * @returns {{phraseIndex: number, desfasada: boolean, huerfana: boolean}}
 */
export function reconciliarIndice(pick) {
  if (!pick || pick.status === "SKIPPED") {
    return { phraseIndex: -1, desfasada: false, huerfana: false };
  }

  const actual = corpus.frases[pick.phraseIndex];
  if (actual && actual.t === pick.phraseText) {
    return { phraseIndex: pick.phraseIndex, desfasada: false, huerfana: false };
  }

  const encontrado = indiceDeTexto(pick.phraseText);
  return {
    phraseIndex: encontrado,
    desfasada: encontrado !== -1,
    // La frase salió del corpus en la última regeneración: se conserva lo
    // guardado, pero ya no hay candidata que la respalde.
    huerfana: encontrado === -1,
  };
}

export function totalFuentes() {
  return corpus.fuentes.length;
}

/** Las 486 fuentes, ordenadas por cuántas asignaciones del año dependen de ellas. */
export function fuentesPorImpacto() {
  const usos = new Map();
  for (const dia of calendario.dias) {
    for (const slots of Object.values(dia.a)) {
      for (const indice of slots) {
        const frase = corpus.frases[indice];
        usos.set(frase.f, (usos.get(frase.f) || 0) + 1);
      }
    }
  }
  return corpus.fuentes
    .map((f, i) => ({ indice: i, autor: f.a, obra: f.o, clave: claveFuente(f), usos: usos.get(i) || 0 }))
    .sort((a, b) => b.usos - a.usos || a.autor.localeCompare(b.autor));
}

// ─── El día ──────────────────────────────────────────────────────────────────

export function existeDia(fecha) {
  return DIA_POR_FECHA.has(fecha);
}

/**
 * Un día completo: metadatos de la fecha y sus 16 candidatas resueltas.
 * Devuelve null fuera de la ventana del corpus, que el panel debe tratar como
 * "el calendario se quedó sin material" y no como un error.
 */
export function diaDeFrases(fecha) {
  const dia = DIA_POR_FECHA.get(fecha);
  if (!dia) return null;

  const candidatas = [];
  for (const audiencia of AUDIENCIAS) {
    const slots = dia.a[audiencia.id] || [];
    slots.forEach((indice, i) => {
      const frase = fraseDeIndice(indice);
      if (!frase) return;
      candidatas.push({
        ...frase,
        audiencia: audiencia.id,
        audienciaLabel: audiencia.label,
        registro: audiencia.registro,
        franja: audiencia.franja,
        genero: audiencia.genero,
        tono: audiencia.tono,
        slot: i + 1,
        rol: ROLES_INTERNOS[i + 1],
      });
    });
  }

  return {
    fecha: dia.d,
    diaSemana: dia.s,
    evento: dia.e,
    calor: dia.k,
    ventanaSensible: dia.v,
    temasDominantes: dia.td,
    vector: dia.vl,
    candidatas,
  };
}

/** Metadatos del día sin resolver las 16 frases (para listados y el mapa). */
export function resumenDia(fecha) {
  const dia = DIA_POR_FECHA.get(fecha);
  if (!dia) return null;
  return {
    fecha: dia.d,
    diaSemana: dia.s,
    evento: dia.e,
    calor: dia.k,
    ventanaSensible: dia.v,
    temasDominantes: dia.td,
    vector: dia.vl,
  };
}

/** Resúmenes de un rango cerrado de fechas. */
export function resumenRango(desde, hasta) {
  return calendario.dias
    .filter((d) => d.d >= desde && d.d <= hasta)
    .map((d) => resumenDia(d.d));
}

/** Curva de calor de un mes, para el mapa térmico. */
export function calorDelMes(anio, mes) {
  const prefijo = `${anio}-${String(mes).padStart(2, "0")}`;
  const dias = calendario.dias.filter((d) => d.d.startsWith(prefijo));
  if (!dias.length) return null;
  const suma = dias.reduce((n, d) => n + d.k, 0);
  return {
    anio,
    mes,
    dias: dias.map((d) => ({ fecha: d.d, calor: d.k, sensible: d.v, evento: d.e })),
    promedio: Number((suma / dias.length).toFixed(2)),
    maximo: Math.max(...dias.map((d) => d.k)),
    sensibles: dias.filter((d) => d.v).length,
  };
}

/** Los días de mayor exposición: calor alto, que el propio corpus pide revisar a mano. */
export function diasDeAltaExposicion(desde, hasta, minimo = 9) {
  return calendario.dias
    .filter((d) => d.d >= desde && d.d <= hasta && d.k >= minimo)
    .map((d) => resumenDia(d.d));
}

// ─── Sesión de trabajo ───────────────────────────────────────────────────────

/**
 * Qué fechas exigen decisión hoy. `resueltas` es el conjunto de fechas que ya
 * tienen frase elegida.
 *
 * Una fecha entra en la lista desde el día de su sesión en adelante, así que si
 * el viernes no se trabajó, el sábado el sábado sigue apareciendo —marcado como
 * atrasado— en vez de desaparecer en silencio.
 */
export function sesionDelDia(fecha, resueltas = new Set(), horizonte = 7) {
  const pendientes = [];
  for (let i = 0; i <= horizonte; i += 1) {
    const objetivo = sumar(fecha, i);
    if (!DIA_POR_FECHA.has(objetivo)) continue;
    if (resueltas.has(objetivo)) continue;
    const sesion = sesionDe(objetivo);
    if (sesion > fecha) continue; // todavía no le toca
    pendientes.push({
      fecha: objetivo,
      sesion,
      atrasada: sesion < fecha,
      enVivo: objetivo <= fecha,
      resumen: resumenDia(objetivo),
    });
  }
  return {
    fecha,
    objetivoDeHoy: diasAPreparar(fecha),
    pendientes,
    atrasadas: pendientes.filter((p) => p.atrasada).length,
  };
}

// ─── Búsqueda para sustituir ─────────────────────────────────────────────────

/**
 * Busca en las 1.112 frases del corpus. Es para el momento en que ninguna de las
 * 16 candidatas del día sirve y hay que traer otra.
 */
export function buscarFrases({
  texto = "",
  autor = "",
  tema = "",
  categoria = "",
  largoMaximo = 0,
  limite = 40,
} = {}) {
  const q = texto.trim().toLowerCase();
  const a = autor.trim().toLowerCase();
  const resultados = [];

  for (let i = 0; i < corpus.frases.length; i += 1) {
    const frase = corpus.frases[i];
    const fuente = corpus.fuentes[frase.f];
    if (q && !frase.t.toLowerCase().includes(q)) continue;
    if (a && !fuente.a.toLowerCase().includes(a)) continue;
    if (tema && !frase.m.includes(tema)) continue;
    if (categoria && frase.c !== categoria) continue;
    if (largoMaximo && frase.t.length > largoMaximo) continue;
    resultados.push(fraseDeIndice(i));
    if (resultados.length >= limite) break;
  }
  return resultados;
}

// ─── Vigencia del corpus ─────────────────────────────────────────────────────
// El corpus cubre una ventana cerrada de 365 días. Cuando se agota, la app se
// queda sin frase: no hay degradación elegante posible más allá del placeholder
// heredado. La alerta se deriva de la fecha real de fin y no de un día fijo en
// el calendario, para que siga siendo correcta si la próxima entrega cambia de
// ventana.

/** Días de aviso antes de que se agote el corpus. */
export const DIAS_DE_AVISO_DE_RENOVACION = 45;

/**
 * Estado de vigencia del corpus. `requiereRenovacion` se enciende 45 días antes
 * del final, que para la ventana actual (termina el 14-ago) cae a fin de junio:
 * cubre con margen el 1.º de agosto y deja tiempo real para producir las 5.840
 * asignaciones del ciclo siguiente.
 */
export function estadoDeVigencia(fecha = hoyEnCostaRica()) {
  const diasRestantes = Math.round(
    (aFecha(ULTIMO_DIA) - aFecha(fecha)) / 86400000,
  );
  return {
    primerDia: PRIMER_DIA,
    ultimoDia: ULTIMO_DIA,
    version: VERSION_CORPUS,
    diasRestantes,
    vencido: diasRestantes < 0,
    requiereRenovacion: diasRestantes <= DIAS_DE_AVISO_DE_RENOVACION,
  };
}

/** Vocabulario del corpus, para los filtros de la página de control. */
export function facetasDelCorpus() {
  const temas = new Set();
  const categorias = new Set();
  const autores = new Set();
  for (const frase of corpus.frases) {
    for (const t of frase.m) temas.add(t);
    categorias.add(frase.c);
    autores.add(corpus.fuentes[frase.f].a);
  }
  return {
    temas: [...temas].sort(),
    categorias: [...categorias].sort(),
    autores: [...autores].sort(),
  };
}

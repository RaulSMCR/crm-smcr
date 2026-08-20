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

import { DEFAULT_TZ, hoyEnCostaRica } from "@/lib/timezone";
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
import { AUDIENCIAS, hashEstable } from "@/lib/frases-audiencia";

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

/** Suma (o resta) días a una fecha ISO, sin salirse del calendario gregoriano. */
export function sumarDias(iso, dias) {
  return sumar(iso, dias);
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

export function totalAutores() {
  return new Set(corpus.fuentes.map((f) => f.a)).size;
}

/** Todas las fuentes, ordenadas por cuántas asignaciones del año dependen de ellas. */
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
 *
 * `usadas` son las frases que ya se publicaron alguna vez. Una frase usada no
 * vuelve a ofrecerse nunca: su casilla se rellena en el momento con la mejor
 * candidata viva para esa audiencia. Por eso el calendario del año dejó de ser
 * una preselección fija —cada elección recalcula lo que se verá después— y por
 * eso este módulo, que sigue siendo puro, recibe el conjunto desde afuera en
 * vez de consultarlo: quien conoce la base es frases-queries.
 *
 * `elegidas` ({audiencia: índice}) son las decisiones ya guardadas de ESTE día.
 * Se exceptúan de la prohibición para su propia audiencia —si no, la elección
 * guardada desaparecería de su propia lista— y siguen bloqueadas para las otras
 * siete.
 */
export function diaDeFrases(fecha, { usadas, elegidas = {} } = {}) {
  const dia = DIA_POR_FECHA.get(fecha);
  if (!dia) return null;

  const quemadas = usadas instanceof Set ? usadas : new Set(usadas || []);

  // Dos frases no pueden coincidir el mismo día aunque ninguna esté usada: el
  // reemplazo de una audiencia no puede pisar la candidata de otra.
  const tomadas = new Set(Object.values(elegidas).filter((i) => Number.isInteger(i) && i >= 0));
  for (const audiencia of AUDIENCIAS) {
    for (const indice of dia.a[audiencia.id] || []) {
      if (!quemadas.has(indice)) tomadas.add(indice);
    }
  }

  const candidatas = [];
  for (const audiencia of AUDIENCIAS) {
    const slots = dia.a[audiencia.id] || [];
    const propia = Number.isInteger(elegidas[audiencia.id]) && elegidas[audiencia.id] >= 0
      ? elegidas[audiencia.id]
      : null;
    // Reemplazos de esta audiencia, calculados solo si hace falta alguno.
    let repuestas = null;
    let siguienteRepuesta = 0;

    slots.forEach((indice, i) => {
      let frase = fraseDeIndice(indice);
      let reemplazo = null;

      if (!frase || (quemadas.has(indice) && indice !== propia)) {
        if (!repuestas) {
          const opciones = alternativasParaAudiencia({
            fecha: dia.d,
            audiencia: audiencia.id,
            excluir: [...quemadas, ...tomadas],
            limite: slots.length,
          }).opciones;
          // La elección ya guardada de esta audiencia va primero: si el corpus
          // perdió su casilla, tiene que seguir apareciendo —y marcada— en la
          // lista de su propia audiencia en vez de desaparecer de la vista.
          repuestas =
            propia !== null && !slots.includes(propia)
              ? [fraseDeIndice(propia), ...opciones]
              : opciones;
        }
        const repuesta = repuestas[siguienteRepuesta];
        siguienteRepuesta += 1;
        if (!repuesta) return; // el corpus se quedó sin material vivo
        reemplazo = { original: frase, porQue: repuesta.porQue };
        frase = repuesta;
        tomadas.add(frase.indice);
      }

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
        // Dónde más sale esta misma frase en los días de alrededor. Es lo que
        // vuelve visible la repetición al revisar día por día.
        repeticiones: repeticionesCercanas(dia.d, frase.indice, { audiencia: audiencia.id }),
        // La del corpus ya se publicó: esta entró en su lugar.
        reemplazo: reemplazo
          ? {
              autorOriginal: reemplazo.original?.autor || null,
              porQue: reemplazo.porQue || [],
            }
          : null,
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
 * Busca en todo el corpus. Es la vía manual —cuando ya se sabe qué autor o qué
 * palabra se quiere— frente a `alternativasParaAudiencia`, que propone sola.
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

// ─── Repetición: dónde más sale cada frase ───────────────────────────────────
//
// El corpus reparte 5.840 asignaciones entre ~1.100 frases, así que cada frase
// sale unas cinco veces al año. Eso no se puede evitar; lo que sí se puede es
// verlo. Quien revisa día por día percibe monotonía cuando las reapariciones
// caen juntas —la misma frase el martes en MR26 y el jueves en HRJ—, y hasta
// ahora el panel no lo decía.

/** Ventana en días dentro de la cual una reaparición se nota al revisar. */
export const VENTANA_REPETICION = 10;

// Índice inverso frase → dónde sale en el calendario. Se construye una vez por
// proceso, igual que INDICE_POR_TEXTO.
const APARICIONES = new Map();
for (const dia of calendario.dias) {
  for (const [aud, slots] of Object.entries(dia.a)) {
    slots.forEach((indice, i) => {
      if (!APARICIONES.has(indice)) APARICIONES.set(indice, []);
      APARICIONES.get(indice).push({ fecha: dia.d, audiencia: aud, slot: i + 1 });
    });
  }
}

function diasEntre(a, b) {
  return Math.round((aFecha(b) - aFecha(a)) / 86400000);
}

/** Todos los lugares del calendario donde el corpus coloca esta frase. */
export function aparicionesDeFrase(indice) {
  return APARICIONES.get(indice) || [];
}

/**
 * Las otras veces que esta frase sale cerca de una fecha. Se excluye su propia
 * casilla —(fecha, audiencia)— pero no las demás audiencias del mismo día: esas
 * también las ve quien revisa, y son parte de la repetición percibida.
 */
export function repeticionesCercanas(fecha, indice, { audiencia = null, ventana = VENTANA_REPETICION } = {}) {
  const cercanas = [];
  for (const ap of aparicionesDeFrase(indice)) {
    if (ap.fecha === fecha && ap.audiencia === audiencia) continue;
    const distancia = diasEntre(fecha, ap.fecha);
    if (Math.abs(distancia) > ventana) continue;
    cercanas.push({ fecha: ap.fecha, audiencia: ap.audiencia, distancia });
  }
  return cercanas.sort((a, b) => Math.abs(a.distancia) - Math.abs(b.distancia));
}

// ─── Alternativas por audiencia ──────────────────────────────────────────────
//
// Cuando las dos candidatas del día no sirven, hay que traer otras. Buscarlas a
// mano en el corpus entero es trabajo de archivo; esto propone directamente un
// puñado ya filtrado para ESA audiencia y ESE día.
//
// El perfil tonal de cada audiencia no se escribe a mano: se deriva de las 730
// asignaciones que el propio corpus le hizo durante el año. Así la propuesta
// respeta el criterio editorial de la base de conocimiento en vez de inventar
// uno paralelo —registradas tiran a Cálidas/Salud/Reflexión, no registradas a
// Motivadoras/Audaces/Fuerza— y sigue siendo correcto si el corpus cambia.

const PERFILES = new Map();

/** Distribución tonal y temática real de una audiencia, normalizada a 0–1. */
export function perfilDeAudiencia(audiencia) {
  if (PERFILES.has(audiencia)) return PERFILES.get(audiencia);

  const categorias = new Map();
  const temas = new Map();
  for (const dia of calendario.dias) {
    for (const indice of dia.a[audiencia] || []) {
      const frase = corpus.frases[indice];
      if (!frase) continue;
      categorias.set(frase.c, (categorias.get(frase.c) || 0) + 1);
      for (const t of frase.m) temas.set(t, (temas.get(t) || 0) + 1);
    }
  }

  const normalizar = (mapa) => {
    const max = Math.max(1, ...mapa.values());
    return new Map([...mapa.entries()].map(([k, v]) => [k, v / max]));
  };

  const perfil = { categorias: normalizar(categorias), temas: normalizar(temas) };
  PERFILES.set(audiencia, perfil);
  return perfil;
}

// Penalización por cercanía, por fecha: cuánto castiga a cada frase del corpus
// el hecho de reaparecer cerca de ese día. Depende solo de la fecha, no de la
// audiencia, así que calcularla una vez por día en vez de una por audiencia
// ahorra las siete pasadas restantes sobre las 1.145 frases. Pesa: con medio
// corpus quemado, una sesión recalcula hasta 64 veces (8 días × 8 audiencias).
const CERCANIA_POR_FECHA = new Map();

function penalizacionPorCercania(fecha) {
  const guardada = CERCANIA_POR_FECHA.get(fecha);
  if (guardada) return guardada;

  const penas = new Float64Array(corpus.frases.length);
  for (const [indice, apariciones] of APARICIONES.entries()) {
    let pena = 0;
    for (const ap of apariciones) {
      if (ap.fecha === fecha) continue;
      const distancia = Math.abs(diasEntre(fecha, ap.fecha));
      if (distancia > VENTANA_REPETICION) continue;
      pena += 3 * (1 - distancia / (VENTANA_REPETICION + 1));
    }
    penas[indice] = pena;
  }

  // La sesión trabaja sobre una decena de días; no hace falta guardar el año.
  if (CERCANIA_POR_FECHA.size > 40) CERCANIA_POR_FECHA.clear();
  CERCANIA_POR_FECHA.set(fecha, penas);
  return penas;
}

let USOS_POR_AUTOR = null;

function usosPorAutor() {
  if (USOS_POR_AUTOR) return USOS_POR_AUTOR;
  const usos = new Map();
  for (const dia of calendario.dias) {
    for (const slots of Object.values(dia.a)) {
      for (const indice of slots) {
        const autor = corpus.fuentes[corpus.frases[indice].f].a;
        usos.set(autor, (usos.get(autor) || 0) + 1);
      }
    }
  }
  USOS_POR_AUTOR = { usos, max: Math.max(1, ...usos.values()) };
  return USOS_POR_AUTOR;
}

const LARGO_HISTORIAS = 175;
const PROFUNDIDAD = 200; // cuántas candidatas entran al reparto por autor

/**
 * Propone frases del corpus para una audiencia en un día, ordenadas por lo bien
 * que le calzan y repartidas entre autores.
 *
 * Se descartan de plano las 16 del día y lo que venga en `excluir` (lo ya visto
 * en esta sesión y lo ya publicado a esta audiencia hace poco, que la acción
 * consulta en base de datos). Lo demás se ordena penalizando justo aquello que
 * produce la monotonía: la frase que ya sale otro día cercano, el autor que ya
 * está en el día y el autor sobrerrepresentado en el año.
 *
 * `pagina` avanza por la lista ordenada, así que «ver otras» nunca repite lo
 * mostrado y sigue siendo determinista.
 */
export function alternativasParaAudiencia({
  fecha,
  audiencia,
  excluir = [],
  penalizar = [],
  limite = 6,
  pagina = 0,
} = {}) {
  const dia = DIA_POR_FECHA.get(fecha);
  const vacio = { opciones: [], pagina: 0, hayMas: false, elegibles: 0 };
  if (!dia || !AUDIENCIA_POR_ID.has(audiencia)) return vacio;

  const perfil = perfilDeAudiencia(audiencia);
  const { usos, max: maxUsos } = usosPorAutor();
  const temasDelDia = new Set(dia.td);

  const delDia = Object.values(dia.a).flat();
  const autoresDelDia = new Set(delDia.map((i) => corpus.fuentes[corpus.frases[i].f].a));
  const autoresDeLaAudiencia = new Set(
    (dia.a[audiencia] || []).map((i) => corpus.fuentes[corpus.frases[i].f].a),
  );

  const excluidos = new Set([...delDia, ...excluir.map(Number)]);
  const penalizados = new Set(penalizar.map(Number));
  const cercania = penalizacionPorCercania(fecha);

  const puntuadas = [];
  for (let i = 0; i < corpus.frases.length; i += 1) {
    if (excluidos.has(i)) continue;
    const frase = corpus.frases[i];
    const autor = corpus.fuentes[frase.f].a;

    let score = 0;
    const porQue = [];

    // Tema del día: es lo que hace que la frase hable de lo que pasa esa fecha.
    const comunes = frase.m.filter((t) => temasDelDia.has(t));
    if (comunes.length) {
      score += Math.min(comunes.length, 2) * 1.6;
      porQue.push(`tema del día: ${comunes.slice(0, 2).join(", ")}`);
    }

    // Tono: cuánto pesa esta categoría en las asignaciones reales de la audiencia.
    const afinidadTonal = perfil.categorias.get(frase.c) || 0;
    score += 2 * afinidadTonal;
    if (afinidadTonal >= 0.7) porQue.push(`tono de ${audiencia}`);

    // Afinidad temática de la audiencia, más suave que la del día.
    if (frase.m.length) {
      const media = frase.m.reduce((n, t) => n + (perfil.temas.get(t) || 0), 0) / frase.m.length;
      score += 0.8 * media;
    }

    // Lo que produce la monotonía, penalizado: cuanto más cerca reaparece la
    // frase en el calendario, más pesa el castigo.
    score -= cercania[i];

    // Ya publicada a esta audiencia hace poco (viene de base de datos).
    if (penalizados.has(i)) score -= 4;

    if (autoresDeLaAudiencia.has(autor)) score -= 2;
    else if (autoresDelDia.has(autor)) score -= 0.8;

    score -= 0.6 * ((usos.get(autor) || 0) / maxUsos);
    if (frase.t.length > LARGO_HISTORIAS) score -= 0.5;

    // Desempate estable por audiencia. Sin esto las ocho audiencias reciben casi
    // la misma lista —el tema del día pesa igual para todas— y sustituir en las
    // ocho volvería a producir monotonía, solo que con otras frases. El desvío
    // es menor que cualquier señal real, así que reordena empates y nada más.
    score += 0.5 * (hashEstable(`${audiencia}:${i}`) / 2 ** 32);

    puntuadas.push({ indice: i, autor, score, porQue });
  }

  puntuadas.sort((a, b) => b.score - a.score || a.indice - b.indice);

  // Reparto por autor: sin esto, las mejores 6 salen casi siempre de los tres
  // autores más presentes del corpus y la propuesta se ve tan monótona como el
  // problema que viene a resolver.
  const restantes = puntuadas.slice(0, PROFUNDIDAD);
  const vecesPorAutor = new Map();
  const orden = [];
  while (restantes.length) {
    let mejor = 0;
    let mejorScore = -Infinity;
    for (let k = 0; k < restantes.length; k += 1) {
      const ajustado = restantes[k].score - 1.2 * (vecesPorAutor.get(restantes[k].autor) || 0);
      if (ajustado > mejorScore) {
        mejorScore = ajustado;
        mejor = k;
      }
    }
    const [elegida] = restantes.splice(mejor, 1);
    vecesPorAutor.set(elegida.autor, (vecesPorAutor.get(elegida.autor) || 0) + 1);
    orden.push(elegida);
  }

  const paginas = Math.max(1, Math.ceil(orden.length / limite));
  const p = Math.min(Math.max(0, Math.trunc(pagina)), paginas - 1);
  // Las reapariciones se resuelven solo para lo que se devuelve: calcularlas
  // para las 1.145 puntuadas es trabajo tirado.
  const opciones = orden.slice(p * limite, p * limite + limite).map((c) => ({
    ...fraseDeIndice(c.indice),
    audiencia,
    porQue: c.porQue,
    repeticiones: repeticionesCercanas(fecha, c.indice),
    aparicionesEnElAnio: aparicionesDeFrase(c.indice).length,
  }));

  return { opciones, pagina: p, hayMas: (p + 1) * limite < orden.length, elegibles: puntuadas.length };
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

/**
 * Cuánto material vivo queda.
 *
 * Con la prohibición de repetir, el corpus dejó de ser un calendario y pasó a
 * ser un stock que se consume: cada elección quema una frase para siempre. Ocho
 * audiencias por día son ocho frases por día, así que el corpus alcanza para
 * `disponibles / 8` días de publicación, sin importar que el calendario cubra
 * 365. Es la aritmética que el panel tiene que decir a la cara.
 */
export function estadoDeStock({ usadas = 0, fecha = PRIMER_DIA, audiencias = AUDIENCIAS.length } = {}) {
  const total = totalFrases();
  const disponibles = Math.max(0, total - usadas);
  const porDia = Math.max(1, audiencias);
  const diasQueAlcanza = Math.floor(disponibles / porDia);
  const diasHastaElFinal = Math.max(0, diasEntre(fecha, ULTIMO_DIA) + 1);

  return {
    total,
    usadas,
    disponibles,
    porDia,
    diasQueAlcanza,
    diasHastaElFinal,
    alcanzaHasta:
      diasQueAlcanza >= diasHastaElFinal ? ULTIMO_DIA : sumar(fecha, Math.max(0, diasQueAlcanza - 1)),
    suficiente: diasQueAlcanza >= diasHastaElFinal,
    // Cuántas frases habría que producir para llegar al final de la ventana.
    faltan: Math.max(0, diasHastaElFinal * porDia - disponibles),
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
    total: corpus.frases.length,
  };
}

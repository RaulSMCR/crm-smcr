// src/lib/tareas-sostenidas.js
//
// El trabajo de SEO y GEO no se hace de una vez: se sostiene. Este módulo define
// qué hay que hacer, cada cuánto, y calcula lo que el panel muestra.
//
// **Principio de diseño, del plan y no negociable: ninguna tarea diaria es de
// medición.** La frecuencia de cada tarea sigue a la velocidad de cambio del
// fenómeno, no a la disponibilidad de quien la ejecuta. La indexación tarda
// semanas, las señales de entidad meses, las citaciones cambian cuando cambia el
// modelo. Revisar métricas se siente como trabajo, da sensación de control y no
// exige enfrentar una página en blanco; producir es incómodo y es lo único que
// mueve el proyecto.

import { hoyEnCostaRica } from "@/lib/timezone";

export const CADENCIAS = Object.freeze({
  DIARIA: "diaria",
  SEMANAL: "semanal",
  MENSUAL: "mensual",
  TRIMESTRAL: "trimestral",
});

export const TAREAS = Object.freeze([
  // --- Hoy: dos ítems, ningún gráfico -------------------------------------
  {
    clave: "escribi",
    cadencia: CADENCIAS.DIARIA,
    titulo: "Escribí hoy",
    detalle:
      "El comentario diario, un tramo del ensayo en curso, o notas de lectura. No importa el volumen; importa la continuidad.",
    campo: { etiqueta: "Qué escribí", tipo: "texto" },
  },
  {
    clave: "contacto",
    cadencia: CADENCIAS.DIARIA,
    titulo: "Contacté a alguien que pueda mencionarnos",
    detalle:
      "Un colega, un medio, un podcast, un espacio donde se discuta clínica. Las menciones de marca fuera del dominio propio correlacionan con visibilidad en IA con más fuerza que los backlinks. Es la tarea que menos se siente como trabajo y la que más pesa.",
    campo: { etiqueta: "A quién, por qué canal, qué pedí", tipo: "texto" },
  },

  // --- Esta semana: 15 minutos --------------------------------------------
  {
    clave: "search_console",
    cadencia: CADENCIAS.SEMANAL,
    titulo: "Revisar Search Console",
    minutos: 5,
    detalle:
      "Mirar solo dos cosas: errores de indexación nuevos y páginas indexadas esta semana. No analizar consultas ni CTR: a esta escala es ruido.",
    enlace: { href: "https://search.google.com/search-console", texto: "Abrir Search Console" },
    campo: { etiqueta: "Errores nuevos y nota libre", tipo: "texto" },
  },
  {
    clave: "bing_ai",
    cadencia: CADENCIAS.SEMANAL,
    titulo: "Revisar Bing Webmaster Tools · AI Performance",
    minutos: 5,
    detalle:
      "Es la única fuente nativa y gratuita que informa citaciones reales en respuestas generadas. Mirar citaciones totales, páginas citadas y grounding queries.",
    enlace: { href: "https://www.bing.com/webmasters", texto: "Abrir Bing Webmaster Tools" },
    campo: { etiqueta: "Citaciones esta semana, páginas citadas", tipo: "texto" },
  },
  {
    clave: "pipeline",
    cadencia: CADENCIAS.SEMANAL,
    titulo: "Revisar el estado del pipeline de contenido",
    minutos: 5,
    detalle:
      "Ver la tabla de abajo. Identificar qué ensayo quedó sin video y qué video quedó sin transcripción subida. Es donde este tipo de flujo se rompe siempre.",
  },

  // --- Este mes: el trabajo real de medición -------------------------------
  {
    clave: "corrida_baseline",
    cadencia: CADENCIAS.MENSUAL,
    titulo: "Corrida del baseline · 30 prompts × 5 motores",
    detalle:
      "Flujo guiado, ~2 h. Se puede pausar y retomar días después: dos horas seguidas no las tiene nadie.",
    bloqueada:
      "Faltan los 30 prompts. Están especificados en smcr-baseline-visibilidad.md, que no está en el repositorio.",
  },
  {
    clave: "publicar_ensayos",
    cadencia: CADENCIAS.MENSUAL,
    titulo: "Publicar dos ensayos",
    detalle: "Quincenal. El estado se lee de la base, no se marca a mano.",
    automatica: true,
  },
  {
    clave: "video_transcripcion",
    cadencia: CADENCIAS.MENSUAL,
    titulo: "Subir el video largo de cada ensayo, con transcripción propia corregida",
    detalle:
      "Nunca la transcripción automática. El activo indexable es el texto, no el video.",
  },
  {
    clave: "deuda_editorial",
    cadencia: CADENCIAS.MENSUAL,
    titulo: "Revisar la deuda editorial",
    detalle: "La tabla de abajo se genera sola desde la base y se va vaciando a medida que se carga.",
  },
  {
    clave: "origen_consultas",
    cadencia: CADENCIAS.MENSUAL,
    titulo: "Revisar el informe de origen de consultas",
    detalle:
      "De dónde dijeron que nos encontraron quienes agendaron este mes. Es la única métrica que gobierna: una cita en ChatGPT no deja UTM, la persona llega escribiendo el nombre directo.",
    campo: { etiqueta: "Qué dijeron", tipo: "texto" },
  },

  // --- Este trimestre -------------------------------------------------------
  {
    clave: "auditoria_tecnica",
    cadencia: CADENCIAS.TRIMESTRAL,
    titulo: "Re-correr la auditoría técnica y comparar con la anterior",
    detalle: "node scripts/verify-seo.mjs docs/backups/urls-produccion-{fecha}.txt --diff {baseline anterior}",
  },
  {
    clave: "evaluar_prompts",
    cadencia: CADENCIAS.TRIMESTRAL,
    titulo: "Evaluar el set de prompts",
    detalle:
      "No modificarlo: el set está congelado doce meses o la serie temporal deja de ser comparable. Solo decidir si hace falta abrir un set B con su propio baseline.",
  },
  {
    clave: "credenciales",
    cadencia: CADENCIAS.TRIMESTRAL,
    titulo: "Revisar el estado de credenciales del equipo",
    detalle: "Colegiaturas vencidas o pendientes de reverificación.",
    enlace: { href: "/panel/admin", texto: "Ver profesionales" },
  },
]);

export const ZONAS = Object.freeze([
  { cadencia: CADENCIAS.DIARIA, titulo: "Hoy", bajada: "Dos cosas. Ningún gráfico." },
  { cadencia: CADENCIAS.SEMANAL, titulo: "Esta semana", bajada: "Quince minutos, un día fijo." },
  { cadencia: CADENCIAS.MENSUAL, titulo: "Este mes", bajada: "El trabajo real de medición." },
  { cadencia: CADENCIAS.TRIMESTRAL, titulo: "Este trimestre", bajada: "Mirar el conjunto." },
]);

// El "hoy" de Costa Rica es uno solo para todo el proyecto y vive en
// timezone.js. Acá había una tercera copia, que es exactamente el patrón que
// terminó dejando a frases.js usando una función que no importaba.
//
// Se reexporta como `hoyCR` para quien ya lo importa con ese nombre. OJO: un
// `export { x as y }` NO crea el identificador `y` dentro del módulo, así que
// adentro hay que seguir usando `hoyEnCostaRica` — usar `hoyCR()` acá sería
// repetir el ReferenceError que este cambio vino a arreglar.
export { hoyEnCostaRica as hoyCR };

/**
 * Días consecutivos escribiendo, hasta hoy.
 *
 * Cuenta solo `escribi` (D13). Contactar se registra y se ve, pero no rompe la
 * racha: una racha que exige dos cosas se corta el doble de rápido, y una racha
 * rota deja de motivar.
 *
 * Si hoy todavía no se marcó, la racha no se corta: se cuenta desde ayer. El día
 * no terminó, y mostrar cero a las nueve de la mañana castiga por no haber
 * escrito todavía.
 *
 * @param {string[]} fechas fechas `YYYY-MM-DD` con `escribi` completado
 */
export function calcularRacha(fechas, hoy = hoyEnCostaRica()) {
  const marcadas = new Set(fechas);
  if (!marcadas.size) return 0;

  const dia = (iso, delta) => {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  };

  let cursor = marcadas.has(hoy) ? hoy : dia(hoy, -1);
  let racha = 0;
  while (marcadas.has(cursor)) {
    racha += 1;
    cursor = dia(cursor, -1);
  }
  return racha;
}

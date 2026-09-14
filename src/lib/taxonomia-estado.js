// src/lib/taxonomia-estado.js
//
// Qué se ve en el sitio y qué no, dicho sin vocabulario de catalogación.
//
// La pantalla de taxonomía mostraba un único dato por término: «N art.», que
// es el conteo crudo de la tabla de unión. Ese número miente en los dos
// sentidos que importan:
//
//   - Una serie con tres artículos en borrador decía «3 art.» y su página
//     pública estaba vacía.
//   - Un tema con artículos cuya etiqueta nadie aprobó decía «2 art.» y su
//     página devolvía 404.
//
// Quien administra no tiene por qué saber que hay tres condiciones encadenadas
// (el artículo publicado, la etiqueta aprobada, el término activo) ni que cada
// tipo de término se comporta distinto: la serie vacía responde 200 con un
// aviso, el tema vacío responde 404, la disciplina no tiene página y la fase no
// existe fuera del panel. Este módulo traduce eso a una frase por fila.
//
// Es lógica pura para poder probarla: la pantalla solo la muestra.

import { slugify } from "@/lib/slug";

/** Tono visual del estado. La pantalla lo mapea a colores. */
export const TONO = {
  VISIBLE: "visible",
  PENDIENTE: "pendiente",
  OCULTO: "oculto",
  NEUTRO: "neutro",
};

const plural = (n, singular, pluralForma) => `${n} ${n === 1 ? singular : pluralForma}`;

/**
 * Estado público de una serie.
 *
 * `/blog/serie/[slug]` no devuelve 404 cuando la serie está vacía: responde 200
 * con «todavía no hay entregas». Para quien llega desde un enlace es lo mismo
 * que un error, así que acá cuenta como no visible.
 *
 * @param {{ isActive?: boolean, entregas?: Array<{ status?: string, seriesApproved?: boolean }> }} serie
 */
export function estadoDeSerie(serie = {}) {
  const entregas = Array.isArray(serie.entregas) ? serie.entregas : [];
  const visibles = entregas.filter((e) => e.status === "PUBLISHED" && e.seriesApproved === true).length;
  const pendientes = entregas.length - visibles;

  if (serie.isActive === false) {
    return {
      tono: TONO.OCULTO,
      etiqueta: "Oculta",
      explicacion: "Su página no abre y la serie no aparece en los filtros de la biblioteca. Los artículos siguen publicados por separado.",
      visibles,
      pendientes,
    };
  }
  if (visibles === 0) {
    return {
      tono: TONO.PENDIENTE,
      etiqueta: "Sin entregas",
      explicacion: entregas.length
        ? `Tiene ${plural(entregas.length, "artículo asignado", "artículos asignados")}, pero ninguno está publicado. Hasta que lo estén, su página abre vacía.`
        : "Todavía no tiene artículos. Se le asignan desde cada artículo, no desde acá.",
      visibles,
      pendientes,
    };
  }
  return {
    tono: TONO.VISIBLE,
    etiqueta: plural(visibles, "entrega", "entregas"),
    explicacion: pendientes === 0
      ? "Se ve en el sitio, con sus entregas en orden."
      : pendientes === 1
        ? "Se ve en el sitio. Queda 1 artículo sin publicar, que todavía no aparece en la lista."
        : `Se ve en el sitio. Quedan ${pendientes} artículos sin publicar, que todavía no aparecen en la lista.`,
    visibles,
    pendientes,
  };
}

/**
 * Estado público de un tema.
 *
 * A diferencia de la serie, `/blog/tema/[slug]` hace `notFound()` cuando no
 * queda ningún artículo: un tema sin artículos es una URL rota, no una página
 * vacía. Por eso el aviso es más fuerte.
 *
 * @param {{ isActive?: boolean, visibles?: number, total?: number }} tema
 */
export function estadoDeTema(tema = {}) {
  const visibles = Number(tema.visibles) || 0;
  const total = Number(tema.total) || 0;
  const sinAprobar = Math.max(total - visibles, 0);

  if (tema.isActive === false) {
    return {
      tono: TONO.OCULTO,
      etiqueta: "Oculto",
      explicacion: "Su página devuelve error y el tema no aparece en los filtros.",
      visibles,
      pendientes: sinAprobar,
    };
  }
  if (visibles === 0) {
    return {
      tono: TONO.PENDIENTE,
      etiqueta: "Sin artículos",
      explicacion: sinAprobar
        ? `Hay ${plural(sinAprobar, "artículo con este tema sugerido", "artículos con este tema sugerido")}, pero sin aprobar o sin publicar. Mientras tanto su página da error.`
        : "Ningún artículo lleva este tema. Su página da error hasta que alguno lo lleve.",
      visibles,
      pendientes: sinAprobar,
    };
  }
  return {
    tono: TONO.VISIBLE,
    etiqueta: plural(visibles, "artículo", "artículos"),
    explicacion: sinAprobar === 0
      ? "Se ve en el sitio, con su propia página de archivo."
      : sinAprobar === 1
        ? "Se ve en el sitio. Hay 1 etiqueta sugerida sin aprobar, que no cuenta."
        : `Se ve en el sitio. Hay ${sinAprobar} etiquetas sugeridas sin aprobar, que no cuentan.`,
    visibles,
    pendientes: sinAprobar,
  };
}

/**
 * Estado de una disciplina. No tiene página propia: es un filtro de `/blog` y
 * una etiqueta al pie de cada artículo.
 *
 * @param {{ isActive?: boolean, visibles?: number, total?: number }} disciplina
 */
export function estadoDeDisciplina(disciplina = {}) {
  const visibles = Number(disciplina.visibles) || 0;
  const total = Number(disciplina.total) || 0;
  const sinAprobar = Math.max(total - visibles, 0);

  if (disciplina.isActive === false) {
    return { tono: TONO.OCULTO, etiqueta: "Oculta", explicacion: "No aparece en los filtros de la biblioteca.", visibles, pendientes: sinAprobar };
  }
  if (visibles === 0) {
    return {
      tono: TONO.PENDIENTE,
      etiqueta: "Sin uso",
      explicacion: "No aparece en los filtros hasta que un artículo publicado la lleve.",
      visibles,
      pendientes: sinAprobar,
    };
  }
  return {
    tono: TONO.VISIBLE,
    etiqueta: plural(visibles, "artículo", "artículos"),
    explicacion: "Aparece como filtro en la biblioteca y como etiqueta en esos artículos.",
    visibles,
    pendientes: sinAprobar,
  };
}

/**
 * Estado de una fase. Las fases no salen del panel: solo agrupan series para
 * que el desplegable del artículo no sea una lista larga. Decirlo evita que se
 * carguen esperando que aparezcan en el sitio.
 *
 * @param {{ isActive?: boolean, series?: number }} fase
 */
export function estadoDeFase(fase = {}) {
  const series = Number(fase.series) || 0;
  if (fase.isActive === false) {
    return { tono: TONO.OCULTO, etiqueta: "Oculta", explicacion: "No se ofrece al clasificar artículos.", visibles: series, pendientes: 0 };
  }
  return {
    tono: TONO.NEUTRO,
    etiqueta: plural(series, "serie", "series"),
    explicacion: "Las fases no tienen página en el sitio: solo ordenan el desplegable al clasificar un artículo.",
    visibles: series,
    pendientes: 0,
  };
}

/**
 * Estado de una entrega dentro de una serie, para la lista de cada serie.
 *
 * @param {{ status?: string, seriesApproved?: boolean }} entrega
 */
export function estadoDeEntrega(entrega = {}) {
  if (entrega.status !== "PUBLISHED") {
    return { tono: TONO.PENDIENTE, etiqueta: "Sin publicar", explicacion: "El artículo todavía no está publicado, así que no aparece en la serie." };
  }
  if (entrega.seriesApproved !== true) {
    return { tono: TONO.PENDIENTE, etiqueta: "Serie sin aprobar", explicacion: "El artículo está publicado, pero su lugar en la serie quedó como sugerencia. Volvé a guardarlo desde el artículo para aprobarlo." };
  }
  return { tono: TONO.VISIBLE, etiqueta: "En la serie", explicacion: "Publicado y en orden." };
}

/**
 * Números de parte repetidos o faltantes dentro de una serie.
 *
 * Un número repetido no rompe nada —el desempate cae en la fecha— pero el orden
 * deja de ser el que se quiso, y eso no se ve en ninguna parte hasta que se
 * abre la página pública y las entregas están cambiadas de lugar.
 *
 * @param {Array<{ seriesOrder?: number|null, status?: string, seriesApproved?: boolean }>} entregas
 * @returns {string|null} aviso listo para mostrar, o null si el orden está sano
 */
export function avisoDeOrden(entregas = []) {
  const visibles = entregas.filter((e) => e.status === "PUBLISHED" && e.seriesApproved === true);
  if (visibles.length < 2) return null;

  const sinNumero = visibles.filter((e) => e.seriesOrder == null).length;
  const vistos = new Map();
  for (const entrega of visibles) {
    if (entrega.seriesOrder == null) continue;
    vistos.set(entrega.seriesOrder, (vistos.get(entrega.seriesOrder) || 0) + 1);
  }
  const repetidos = [...vistos.entries()].filter(([, veces]) => veces > 1).map(([numero]) => numero);

  if (repetidos.length) {
    return `Hay más de una entrega con el número ${repetidos.join(" y ")}. El orden en el sitio queda librado a la fecha de publicación; poné un número distinto a cada una.`;
  }
  if (sinNumero) {
    return `${plural(sinNumero, "entrega no tiene", "entregas no tienen")} número de parte. Las que no lo tienen se ordenan por fecha, al final.`;
  }
  return null;
}

/**
 * Aviso antes de renombrar un término.
 *
 * Al renombrar, la acción recalcula el slug —y el slug es la URL pública—. No
 * hay redirección de la dirección vieja: los enlaces existentes quedan en 404,
 * incluido el de la serie destacada del hub, que guarda el slug a mano. Esto no
 * se puede deducir de la pantalla, así que se avisa antes de guardar.
 *
 * @param {string} nombreActual
 * @param {string} nombreNuevo
 * @param {{ tienePaginaPublica?: boolean, esVisible?: boolean }} [contexto]
 * @returns {string|null} texto para confirmar, o null si no hace falta avisar
 */
export function avisoDeRenombrado(nombreActual, nombreNuevo, contexto = {}) {
  const anterior = slugify(nombreActual);
  const nuevo = slugify(nombreNuevo);
  if (!nuevo || anterior === nuevo) return null;
  if (!contexto.tienePaginaPublica) return null;

  const base = `Al cambiar el nombre también cambia la dirección de su página:\n\n  antes:   ${anterior}\n  después: ${nuevo}\n\nLa dirección anterior deja de funcionar y no se redirige sola.`;
  return contexto.esVisible
    ? `${base}\n\nEsta página ya está publicada: cualquier enlace que apunte a ella —incluido el del hub— va a dar error. ¿Renombrar igual?`
    : `${base}\n\n¿Renombrar igual?`;
}
